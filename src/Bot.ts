BkperApp.setApiKey(PropertiesService.getScriptProperties().getProperty('API_KEY'));

let STOCK_EXC_CODE_PROP = 'stock_exc_code';

function doGet(e: GoogleAppsScript.Events.AppsScriptHttpRequestEvent) {
  //@ts-ignore
  let bookId = e.parameter.bookId;
  //@ts-ignore
  let accountId = e.parameter.accountId;
  return BotService.getBotViewTemplate(bookId, accountId);
}

function calculateRealizedResults(bookId: string, accountId: string): void {
  BotService.calculateRealizedResults(bookId, accountId);
}

function onTransactionChecked(event: bkper.Event) {
  return new EventHandlerTransactionChecked().handleEvent(event);
}

function onTransactionUpdated(event: bkper.Event) {
  return new EventHandlerTransactionUpdated().handleEvent(event);
}

function onTransactionDeleted(event: bkper.Event) {
  return new EventHandlerTransactionDeleted().handleEvent(event);
}

function onTransactionRestored(event: bkper.Event) {
  return new EventHandlerTransactionRestored().handleEvent(event);
}

function onAccountCreated(event: bkper.Event) {
  return new EventHandlerAccountCreatedOrUpdated().handleEvent(event);
}

function onAccountUpdated(event: bkper.Event) {
  return new EventHandlerAccountCreatedOrUpdated().handleEvent(event);
}

function onAccountDeleted(event: bkper.Event) {
  return new EventHandlerAccountDeleted().handleEvent(event);
}

function onGroupCreated(event: bkper.Event) {
  return new EventHandlerGroupCreatedOrUpdated().handleEvent(event);
}

function onGroupUpdated(event: bkper.Event) {
  return new EventHandlerGroupCreatedOrUpdated().handleEvent(event);
}

function onGroupDeleted(event: bkper.Event) {
  return new EventHandlerGroupDeleted().handleEvent(event);
}







