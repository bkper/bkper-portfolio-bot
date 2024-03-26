import { Account, AccountType, Amount, Book } from "bkper";
import { Result } from ".";
import { isStockBook } from "./BotService";
import { COST_HIST_PROP, FEES_PROP, INSTRUMENT_PROP, INTEREST_PROP, ORDER_PROP, PRICE_HIST_PROP, PRICE_PROP, QUANTITY_PROP, SETTLEMENT_DATE, STOCK_FEES_ACCOUNT_PROP, TRADE_DATE_PROP } from "./constants";

export class InterceptorOrderProcessor {

    async intercept(baseBook: Book, event: bkper.Event): Promise<Result> {

        if (event.agent.id == 'exchange-bot') {
            return { result: false };
        }

        if (isStockBook(baseBook)) {
            return { result: false };
        }

        let operation = event.data.object as bkper.TransactionOperation;
        let transactionPayload = operation.transaction;

        if (!transactionPayload.posted) {
            return { result: false };
        }

        const quantity = this.getQuantity(baseBook, transactionPayload);
        if (quantity == null) {
            return { result: false };
        }
        if (quantity.eq(0)) {
            throw `Quantity must not be zero`;
        }

        if (this.isPurchase(baseBook, transactionPayload)) {
            return this.processPurchase(baseBook, transactionPayload);
        }

        if (this.isSale(baseBook, transactionPayload)) {
            return this.processSale(baseBook, transactionPayload);
        }

        return { result: false };

    }

    protected async processSale(baseBook: Book, transactionPayload: bkper.Transaction): Promise<Result> {
        let exchangeAccount = this.getExchangeAccountOnSale(baseBook, transactionPayload);

        let responses: string[] = await Promise.all(
            [
                this.postFees(baseBook, exchangeAccount, transactionPayload),
                this.postInterestOnSale(baseBook, exchangeAccount, transactionPayload),
                this.postInstrumentTradeOnSale(baseBook, exchangeAccount, transactionPayload)
            ]);

        responses = responses.filter(r => r != null).filter(r => typeof r === "string")

        return { result: responses };
    }

    protected async processPurchase(baseBook: Book, transactionPayload: bkper.Transaction): Promise<Result> {
        let exchangeAccount = this.getExchangeAccountOnPurchase(baseBook, transactionPayload);
        let responses: string[] = await Promise.all(
            [
                this.postFees(baseBook, exchangeAccount, transactionPayload),
                this.postInterestOnPurchase(baseBook, exchangeAccount, transactionPayload),
                this.postInstrumentTradeOnPurchase(baseBook, exchangeAccount, transactionPayload)
            ]);
        responses = responses.filter(r => r != null).filter(r => typeof r === "string")
        return { result: responses };
    }

    protected isPurchase(baseBook: Book, transactionPayload: bkper.Transaction): boolean {

        if (this.getInstrument(transactionPayload) == null) {
            return false;
        }

        if (this.getTradeDate(transactionPayload) == null) {
            return false;
        }

        let exchangeAccount = transactionPayload.debitAccount;

        if (this.getFeesAccountName(exchangeAccount) == null) {
            return false;
        }

        return true;
    }


    protected isSale(baseBook: Book, transactionPayload: bkper.Transaction): boolean {

        if (this.getInstrument(transactionPayload) == null) {
            return false;
        }

        if (this.getTradeDate(transactionPayload) == null) {
            return false;
        }

        let exchangeAccount = transactionPayload.creditAccount;
        if (this.getFeesAccountName(exchangeAccount) == null) {
            return false;
        }

        return true;
    }


    private getExchangeAccountOnSale(baseBook: Book, transactionPayload: bkper.Transaction): bkper.Account {
        return transactionPayload.creditAccount;
    }

    private getExchangeAccountOnPurchase(baseBook: Book, transactionPayload: bkper.Transaction): bkper.Account {
        return transactionPayload.debitAccount;
    }

    protected async getInstrumentAccount(baseBook: Book, transactionPayload: bkper.Transaction): Promise<Account> {
        let instrument = this.getInstrument(transactionPayload);
        let instrumentAccount = await baseBook.getAccount(instrument);
        if (instrumentAccount == null) {
            instrumentAccount = await baseBook.newAccount().setName(instrument).setType(AccountType.ASSET).create();
        }
        return instrumentAccount;
    }

    protected getQuantity(book: Book, transactionPayload: bkper.Transaction): Amount {
        let quantityProp = transactionPayload.properties[QUANTITY_PROP];
        if (quantityProp == null) {
            return null;
        }
        return book.parseValue(quantityProp);
    }

    protected getInstrument(transactionPayload: bkper.Transaction): string {
        return transactionPayload.properties[INSTRUMENT_PROP];
    }

    protected getTradeDate(transactionPayload: bkper.Transaction): string {
        return transactionPayload.properties[TRADE_DATE_PROP];
    }

    protected getOrder(book: Book, transactionPayload: bkper.Transaction): string {
        const orderProp = transactionPayload.properties[ORDER_PROP];
        if (orderProp == null) {
            return null;
        }
        const orderAmount = book.parseValue(orderProp);
        if (orderAmount == null) {
            return null;
        }
        return orderAmount.round(0).toString();
    }

    protected getFees(book: Book, transactionPayload: bkper.Transaction): Amount {
        const fees = book.parseValue(transactionPayload.properties[FEES_PROP]);
        if (fees == null) {
            return new Amount(0);
        }
        return fees;
    }

    protected getInterest(book: Book, transactionPayload: bkper.Transaction): Amount {
        const insterest = book.parseValue(transactionPayload.properties[INTEREST_PROP]);
        if (insterest == null) {
            return new Amount(0);
        }
        return insterest;
    }

    protected getFeesAccountName(exchangeAccount: bkper.Account): string {
        return exchangeAccount.properties[STOCK_FEES_ACCOUNT_PROP];
    }

    protected async getFeesAccount(baseBook: Book, feesAccountName: string): Promise<Account> {
        let feesAccount = await baseBook.getAccount(feesAccountName);
        if (feesAccount == null) {
            feesAccount = await baseBook.newAccount().setName(feesAccountName).setType(AccountType.OUTGOING).create();
        }
        return feesAccount;
    }

    private async getInterestAccount(instrument: string, baseBook: Book) {
        let interestAccountName = `${instrument} Interest`;
        let interestAccount = await baseBook.getAccount(interestAccountName);
        if (interestAccount == null) {
            interestAccount = await baseBook.newAccount().setName(interestAccountName).setType(AccountType.ASSET).create();
        }
        return interestAccount;
    }


    protected async postFees(baseBook: Book, exchangeAccount: bkper.Account, transactionPayload: bkper.Transaction): Promise<string> {
        let fees = this.getFees(baseBook, transactionPayload);
        if (!fees.eq(0)) {
            let tradeDate = this.getTradeDate(transactionPayload);
            let feesAccountName = this.getFeesAccountName(exchangeAccount);
            let feesAccount = await this.getFeesAccount(baseBook, feesAccountName);
            let tx = await baseBook.newTransaction()
                .setAmount(fees)
                .from(exchangeAccount)
                .to(feesAccount)
                .setDescription(transactionPayload.description)
                .setDate(tradeDate)
                .addRemoteId(`${FEES_PROP}_${transactionPayload.id}`)
                .post();

            return `${tx.getDate()} ${tx.getAmount()} ${await tx.getCreditAccountName()} ${await tx.getDebitAccountName()} ${tx.getDescription()}`;
        }
        return null;
    }


    protected async postInterestOnPurchase(baseBook: Book, exchangeAccount: bkper.Account, transactionPayload: bkper.Transaction): Promise<string> {
        let instrument = this.getInstrument(transactionPayload);
        let interest = this.getInterest(baseBook, transactionPayload);
        if (!interest.eq(0)) {
            let tradeDate = this.getTradeDate(transactionPayload);
            let interestAccount = await this.getInterestAccount(instrument, baseBook);
            let tx = await baseBook.newTransaction()
                .setAmount(interest)
                .from(exchangeAccount)
                .to(interestAccount)
                .setDescription(transactionPayload.description)
                .setDate(tradeDate)
                .addRemoteId(`${INTEREST_PROP}_${transactionPayload.id}`)
                .post();
            return `${tx.getDate()} ${tx.getAmount()} ${await tx.getCreditAccountName()} ${await tx.getDebitAccountName()} ${tx.getDescription()}`;
        }
        return null;
    }

    protected async postInterestOnSale(baseBook: Book, exchangeAccount: bkper.Account, transactionPayload: bkper.Transaction): Promise<string> {
        let instrument = this.getInstrument(transactionPayload);
        let interest = this.getInterest(baseBook, transactionPayload);
        if (!interest.eq(0)) {
            let interestAccount = await this.getInterestAccount(instrument, baseBook);
            let tradeDate = this.getTradeDate(transactionPayload);
            let tx = await baseBook.newTransaction()
                .setAmount(interest)
                .from(interestAccount)
                .to(exchangeAccount)
                .setDescription(transactionPayload.description)
                .setDate(tradeDate)
                .addRemoteId(`${INTEREST_PROP}_${transactionPayload.id}`)
                .post();
            return `${tx.getDate()} ${tx.getAmount()} ${await tx.getCreditAccountName()} ${await tx.getDebitAccountName()} ${tx.getDescription()}`;
        }
        return null;
    }

    protected async postInstrumentTradeOnPurchase(baseBook: Book, exchangeAccount: bkper.Account, transactionPayload: bkper.Transaction): Promise<string> {
        let instrumentAccount = await this.getInstrumentAccount(baseBook, transactionPayload);
        let quantity = this.getQuantity(baseBook, transactionPayload);
        let fees = this.getFees(baseBook, transactionPayload);
        let order = this.getOrder(baseBook, transactionPayload);
        let interest = this.getInterest(baseBook, transactionPayload);
        let tradeDate = this.getTradeDate(transactionPayload);
        const amount = new Amount(transactionPayload.amount).minus(interest).minus(fees);
        const price = amount.div(quantity);
        const priceHist = this.getPurchasePriceHist(transactionPayload, interest, fees, quantity);
        let tx = await baseBook.newTransaction()
            .setAmount(amount)
            .from(exchangeAccount)
            .to(instrumentAccount)
            .setDescription(transactionPayload.description)
            .setDate(tradeDate)
            .setProperty(QUANTITY_PROP, quantity.toString())
            .setProperty(PRICE_PROP, price.toString())
            .setProperty(PRICE_HIST_PROP, priceHist?.toString())
            .setProperty(ORDER_PROP, order)
            .setProperty(SETTLEMENT_DATE, transactionPayload.date)
            .setProperty(FEES_PROP, fees.toString())
            .setProperty(INTEREST_PROP, interest.toString())
            .addRemoteId(`${INSTRUMENT_PROP}_${transactionPayload.id}`)
            .post();
        return `${tx.getDate()} ${tx.getAmount()} ${await tx.getCreditAccountName()} ${await tx.getDebitAccountName()} ${tx.getDescription()}`;
    }

    private getPurchasePriceHist(transactionPayload: bkper.Transaction, interest: Amount, fees: Amount, quantity: Amount): Amount | null {
        const costHistProp = transactionPayload.properties[COST_HIST_PROP];
        if (costHistProp) {
            const costHist = new Amount(costHistProp).abs();
            const purchaseAmountHist = costHist.minus(interest).minus(fees);
            return purchaseAmountHist.div(quantity);
        }
        return null;
    }

    protected async postInstrumentTradeOnSale(baseBook: Book, exchangeAccount: bkper.Account, transactionPayload: bkper.Transaction): Promise<string> {
        let instrumentAccount = await this.getInstrumentAccount(baseBook, transactionPayload);
        let quantity = this.getQuantity(baseBook, transactionPayload);
        let fees = this.getFees(baseBook, transactionPayload);
        let order = this.getOrder(baseBook, transactionPayload);
        let interest = this.getInterest(baseBook, transactionPayload);
        let tradeDate = this.getTradeDate(transactionPayload);
        const amount = new Amount(transactionPayload.amount).minus(interest).plus(fees);
        const price = amount.div(quantity);
        const priceHist = this.getSalePriceHist(transactionPayload, interest, fees, quantity);
        let tx = await baseBook.newTransaction()
            .setAmount(amount)
            .from(instrumentAccount)
            .to(exchangeAccount)
            .setDescription(transactionPayload.description)
            .setDate(tradeDate)
            .setProperty(QUANTITY_PROP, quantity.toString())
            .setProperty(PRICE_PROP, price.toString())
            .setProperty(PRICE_HIST_PROP, priceHist?.toString())
            .setProperty(ORDER_PROP, order)
            .setProperty(SETTLEMENT_DATE, transactionPayload.date)
            .setProperty(FEES_PROP, fees.toString())
            .setProperty(INTEREST_PROP, interest.toString())
            .addRemoteId(`${INSTRUMENT_PROP}_${transactionPayload.id}`)
            .post();
        return `${tx.getDate()} ${tx.getAmount()} ${await tx.getCreditAccountName()} ${await tx.getDebitAccountName()} ${tx.getDescription()}`;
    }

    private getSalePriceHist(transactionPayload: bkper.Transaction, interest: Amount, fees: Amount, quantity: Amount): Amount | null {
        const costHistProp = transactionPayload.properties[COST_HIST_PROP];
        if (costHistProp) {
            const costHist = new Amount(costHistProp).abs();
            const saleAmountHist = costHist.minus(interest).plus(fees);
            return saleAmountHist.div(quantity);
        }
        return null;
    }

}
