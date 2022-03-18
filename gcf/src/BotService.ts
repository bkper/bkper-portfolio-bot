import { Account, AccountType, Bkper, Book, Group, Transaction } from 'bkper';
import { EXC_CODE_PROP, LEGACY_REALIZED_DATE_PROP, NEEDS_REBUILD_PROP, REALIZED_DATE_PROP, STOCK_BOOK_PROP, STOCK_EXC_CODE_PROP } from './constants';

export function isStockBook(book: Book): boolean {
  if (book.getProperty(STOCK_BOOK_PROP)) {
    return true;
  }
  if (book.getFractionDigits() == 0) {
    return true;
  }
  return false;
}
export function getStockBook(book: Book): Book {
  if (book.getCollection() == null) {
    return null;
  }
  let connectedBooks = book.getCollection().getBooks();
  for (const connectedBook of connectedBooks) {
    if (connectedBook.getProperty(STOCK_BOOK_PROP)) {
      return connectedBook;
    }
    let fractionDigits = connectedBook.getFractionDigits();
    if (fractionDigits == 0) {
      return connectedBook;
    }
  }
  return null;
}

export async function getStockAccount(stockTransaction: Transaction): Promise<Account> {
  if (await isSale(stockTransaction)) {1
    return await stockTransaction.getCreditAccount();
  }
  if (await isPurchase(stockTransaction)) {
    return await stockTransaction.getDebitAccount();
  }
  return null;
}

export async function flagStockAccountForRebuildIfNeeded(stockTransaction: Transaction) {
  let stockAccount = await getStockAccount(stockTransaction);
  if (stockAccount) {
    let lastTxDate = getRealizedDateValue(stockAccount);
    if (lastTxDate != null && stockTransaction.getDateValue() <= +lastTxDate) {
      await stockAccount.setProperty(NEEDS_REBUILD_PROP, 'TRUE').update();
    }
  }
}

export function getRealizedDateValue(account: Account): number | null {
    const legacyRealizedDate = account.getProperty(LEGACY_REALIZED_DATE_PROP);
    if (legacyRealizedDate) {
        return +legacyRealizedDate;
    }
    const realizedDate = account.getProperty(REALIZED_DATE_PROP)
    if (realizedDate) {
        return +(realizedDate.replace(/-/g, ""))
    }
    return null
}

export function getStockExchangeCode(account: bkper.Account): string {
  if (account == null || account.type == AccountType.INCOMING || account.type == AccountType.OUTGOING) {
    return null;
  }
  let groups = account.groups;
  if (groups != null) {
    for (const group of groups) {
      if (group == null) {
        continue;
      }

      let stockExchange = group.properties[STOCK_EXC_CODE_PROP];
      if (stockExchange != null && stockExchange.trim() != '') {
        return stockExchange;
      }
    }
  }

  return null;
}

export async function getStockExchangeGroup(account: Account): Promise<Group> {
  if (account == null || account.getType() != AccountType.ASSET) {
    return null;
  }
  let groups = await account.getGroups();
  if (groups != null) {
    for (const group of groups) {
      let stockExchange = group.getProperty(STOCK_EXC_CODE_PROP);
      if (stockExchange != null && stockExchange.trim() != '') {
        return group;
      }
    }
  }
  return null;
}

export async function isSale(transaction: Transaction): Promise<boolean> {
  return transaction.isPosted() && (await transaction.getDebitAccount()).getType() == AccountType.OUTGOING;
}

export async function isPurchase(transaction: Transaction): Promise<boolean> {
  return transaction.isPosted() && (await transaction.getCreditAccount()).getType() == AccountType.INCOMING;
}

export function getExcCode(book: Book): string {
  return book.getProperty(EXC_CODE_PROP, 'exchange_code');
}

