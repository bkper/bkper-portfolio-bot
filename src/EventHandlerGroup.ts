abstract class EventHandlerGroup extends EventHandler {

  protected processObject(baseBook: Bkper.Book, connectedBook: Bkper.Book, event: bkper.Event): string {
    let connectedCode = this.getBaseCode(connectedBook);
    let group = event.data.object as bkper.Group;

    let stockExcCode = group.properties[this.STOCK_EXC_CODE_PROP];

    if (!this.matchStockExchange(stockExcCode, connectedCode)) {
      return null;
    }

    let connectedGroup = connectedBook.getGroup(group.name);
    if (connectedGroup == null && (event.data.previousAttributes && event.data.previousAttributes['name'])) {
      connectedGroup = connectedBook.getGroup(event.data.previousAttributes['name']);
    }

    if (connectedGroup) {
      return this.connectedGroupFound(baseBook, connectedBook, group, connectedGroup);
    } else {
      return this.connectedGroupNotFound(baseBook, connectedBook, group);
    }
  }

  protected abstract connectedGroupNotFound(baseBook: Bkper.Book, connectedBook: Bkper.Book, group: bkper.Group): string;

  protected abstract connectedGroupFound(baseBook: Bkper.Book, connectedBook: Bkper.Book, group: bkper.Group, connectedGroup: Bkper.Group): string;

}