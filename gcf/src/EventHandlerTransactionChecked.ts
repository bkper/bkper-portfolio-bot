import { Account, AccountType, Amount, Book, Transaction } from "bkper";
import { getStockExchangeCode, getRealizedDateValue } from "./BotService";
import * as constants from "./constants";
import { EventHandlerTransaction } from "./EventHandlerTransaction";
import { InterceptorFlagRebuild } from "./InterceptorFlagRebuild";

export class EventHandlerTransactionChecked extends EventHandlerTransaction {

  protected getTransactionQuery(transaction: bkper.Transaction): string {
    return `remoteId:${transaction.id}`;
  }

  async intercept(baseBook: Book, event: bkper.Event): Promise<string[] | string | boolean> {
    let response = await new InterceptorFlagRebuild().intercept(baseBook, event);
    return response;
  }

  protected async connectedTransactionFound(financialBook: Book, stockBook: Book, transaction: bkper.Transaction, connectedTransaction: Transaction, stockExcCode: string): Promise<string> {
    let bookAnchor = super.buildBookAnchor(stockBook);
    let record = `${connectedTransaction.getDate()} ${connectedTransaction.getAmount()} ${await connectedTransaction.getCreditAccountName()} ${await connectedTransaction.getDebitAccountName()} ${connectedTransaction.getDescription()}`;
    return `FOUND: ${bookAnchor}: ${record}`;
  }

  protected async connectedTransactionNotFound(financialBook: Book, stockBook: Book, transaction: bkper.Transaction, stockExcCode: string): Promise<string> {
    let financialCreditAccount = transaction.creditAccount;
    let financialDebitAccount = transaction.debitAccount;
    let stockBookAnchor = super.buildBookAnchor(stockBook);

    let quantity = this.getQuantity(stockBook, transaction);
    if (quantity == null || quantity.eq(0)) {
      return null;
    }

    const originalAmount = new Amount(transaction.amount);

    let price = originalAmount.div(quantity);

    let stockAccount = await this.getConnectedStockAccount(financialBook, stockBook, financialCreditAccount);

    
    if (stockAccount) {
      //Selling
      let stockSellAccount = await stockBook.getAccount(constants.STOCK_SELL_ACCOUNT_NAME);
      if (stockSellAccount == null) {
        stockSellAccount = await stockBook.newAccount().setName(constants.STOCK_SELL_ACCOUNT_NAME).setType(AccountType.OUTGOING).create();
      }

      let newTransaction = await stockBook.newTransaction()
      .setDate(transaction.date)
      .setAmount(quantity)
      .setCreditAccount(stockAccount)
      .setDebitAccount(stockSellAccount)
      .setDescription(transaction.description)
      .addRemoteId(transaction.id)
      .setProperty(constants.SALE_PRICE_PROP, price.toString())
      .setProperty(constants.ORDER_PROP, transaction.properties[constants.ORDER_PROP])
      .setProperty(constants.ORIGINAL_QUANTITY_PROP, quantity.toString())
      .setProperty(constants.ORIGINAL_AMOUNT_PROP, originalAmount.toString())
      .setProperty(constants.STOCK_EXC_CODE_PROP, stockExcCode)
      .post()

      this.checkLastTxDate(stockAccount, transaction);

      let record = `${newTransaction.getDate()} ${newTransaction.getAmount()} ${stockAccount.getName()} ${stockSellAccount.getName()} ${newTransaction.getDescription()}`;
      return `SELL: ${stockBookAnchor}: ${record}`;

    } else {
      stockAccount = await this.getConnectedStockAccount(financialBook, stockBook, financialDebitAccount);
      if (stockAccount) {

        //Buying
        let stockBuyAccount = await stockBook.getAccount(constants.STOCK_BUY_ACCOUNT_NAME);
        if (stockBuyAccount == null) {
          stockBuyAccount = await stockBook.newAccount().setName(constants.STOCK_BUY_ACCOUNT_NAME).setType(AccountType.INCOMING).create();
        }        

        let newTransaction = await stockBook.newTransaction()
        .setDate(transaction.date)
        .setAmount(quantity)
        .setCreditAccount(stockBuyAccount)
        .setDebitAccount(stockAccount)
        .setDescription(transaction.description)
        .addRemoteId(transaction.id)
        .setProperty(constants.PURCHASE_PRICE_PROP, price.toString())
        .setProperty(constants.ORDER_PROP, transaction.properties[constants.ORDER_PROP])
        .setProperty(constants.ORIGINAL_QUANTITY_PROP, quantity.toString())
        .setProperty(constants.ORIGINAL_AMOUNT_PROP, originalAmount.toString())
        .setProperty(constants.STOCK_EXC_CODE_PROP, stockExcCode)
        .post()

        this.checkLastTxDate(stockAccount, transaction);

        let record = `${newTransaction.getDate()} ${newTransaction.getAmount()} ${stockBuyAccount.getName()} ${stockAccount.getName()} ${newTransaction.getDescription()}`;
        return `BUY: ${stockBookAnchor}: ${record}`;
      }

    }


    return null;

  }

  private checkLastTxDate(stockAccount: Account, transaction: bkper.Transaction) {
    let lastTxDate = getRealizedDateValue(stockAccount);
    if (lastTxDate != null && transaction.dateValue <= +lastTxDate) {
      stockAccount.setProperty(constants.NEEDS_REBUILD_PROP, 'TRUE').update();
    }
  }

  private async getConnectedStockAccount(financialBook: Book, stockBook: Book, financialAccount: bkper.Account): Promise<Account> {
    let stockExchangeCode = getStockExchangeCode(financialAccount);
    if (stockExchangeCode != null) {
      let stockAccount = await stockBook.getAccount(financialAccount.name);
      if (stockAccount == null) {
        stockAccount = stockBook.newAccount()
          .setName(financialAccount.name)
          .setType(financialAccount.type as AccountType)
          .setProperties(financialAccount.properties)
          .setArchived(financialAccount.archived);
        if (financialAccount.groups) {
          for (const financialGroup of financialAccount.groups) {
            if (financialGroup) {
              let stockGroup = await stockBook.getGroup(financialGroup.name);
              let stockExcCode = financialGroup.properties[constants.STOCK_EXC_CODE_PROP];
              if (stockGroup == null && stockExcCode != null && stockExcCode.trim() != '') {
                stockGroup = await stockBook.newGroup()
                  .setHidden(financialGroup.hidden)
                  .setName(financialGroup.name)
                  .setProperties(financialGroup.properties)
                  .create();
              }
              stockAccount.addGroup(stockGroup);
            }
          }
        }
        stockAccount = await stockAccount.create();
      }
      return stockAccount;
    }
    return null;
  }

}