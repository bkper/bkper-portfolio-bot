import { Book } from "bkper";
import { STOCK_HISTORICAL_PROP, EXC_HISTORICAL_PROP, STOCK_BOOK_PROP } from "./constants";
import { EventHandler } from "./EventHandler";
import { isStockBook, getBaseBook } from "./BotService";

export class EventHandlerBookUpdated extends EventHandler {

    protected async processObject(book: Book, connectedBook: Book, event: bkper.Event): Promise<string> {

        let response = '';
        const baseBook = getBaseBook(book);

        if (isStockBook(book)) {
            // stock_historical prop
            const stockHistorical = book.getProperty(STOCK_HISTORICAL_PROP);
            if (stockHistorical != baseBook.getProperty(EXC_HISTORICAL_PROP)) {
                baseBook.setProperty(EXC_HISTORICAL_PROP, stockHistorical);
                response += ` ${EXC_HISTORICAL_PROP}: ${stockHistorical}`;
            }
        }

        // stock_book prop
        const stockBookProp = book.getProperty(STOCK_BOOK_PROP);
        if (stockBookProp) {
            const collection = book.getCollection();
            if (collection) {
                for (const collectionBook of collection.getBooks()) {
                    if (collectionBook.getProperty(STOCK_BOOK_PROP) && collectionBook.getId() !== book.getId()) {
                        collectionBook.setProperty(STOCK_BOOK_PROP, '').update();
                    }
                }
            }
        }

        if (response !== '') {
            await baseBook.update();
            return `${this.buildBookAnchor(baseBook)}: ${response}`;
        }

        return null;

    }

}
