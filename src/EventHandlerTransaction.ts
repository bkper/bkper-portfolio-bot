interface AmountDescription {
  amount: number;
  description: string;
}

abstract class EventHandlerTransaction extends EventHandler {

  processObject(baseBook: Bkper.Book, connectedBook: Bkper.Book, event: bkper.Event): string {

    let operation = event.data.object as bkper.TransactionOperation;
    let transaction = operation.transaction;
    let iterator = connectedBook.getTransactions(this.getTransactionQuery(transaction));
    if (iterator.hasNext()) {
      let connectedTransaction = iterator.next();
      return this.connectedTransactionFound(baseBook, connectedBook, transaction, connectedTransaction);
    } else {
      return this.connectedTransactionNotFound(baseBook, connectedBook, transaction)
    }
  }
  
  protected getQuantity(transaction: bkper.Transaction): number {
    let quantityStr = transaction.properties['quantity'];
    if (quantityStr == null || quantityStr.trim() == '') {
      return null;
    }
    return new Number(quantityStr).valueOf();
  }

  protected abstract getTransactionQuery(transaction: bkper.Transaction): string;

  protected abstract connectedTransactionNotFound(baseBook: Bkper.Book, connectedBook: Bkper.Book, transaction: bkper.Transaction): string;

  protected abstract connectedTransactionFound(baseBook: Bkper.Book, connectedBook: Bkper.Book, transaction: bkper.Transaction, connectedTransaction: Bkper.Transaction): string;
}