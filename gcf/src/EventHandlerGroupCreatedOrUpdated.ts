import { Book, Group } from "bkper";
import { EventHandlerGroup } from "./EventHandlerGroup";

export class EventHandlerGroupCreatedOrUpdated extends EventHandlerGroup {
  protected async connectedGroupNotFound(financialBook: Book, stockBook: Book, financialGroup: bkper.Group): Promise<string> {
    let connectedGroup = await stockBook.newGroup()
    .setName(financialGroup.name)
    .setHidden(financialGroup.hidden)
    .setProperties(financialGroup.properties)
    .create();
    let bookAnchor = super.buildBookAnchor(stockBook);
    return `${bookAnchor}: GROUP ${connectedGroup.getName()} CREATED`;
  }
  protected async connectedGroupFound(financialBook: Book, stockBook: Book, financialGroup: bkper.Group, stockGroup: Group): Promise<string> {
    await stockGroup
    .setName(financialGroup.name)
    .setHidden(financialGroup.hidden)
    .setProperties(financialGroup.properties)
    .update();
    let bookAnchor = super.buildBookAnchor(stockBook);
    return `${bookAnchor}: GROUP ${stockGroup.getName()} UPDATED`;
  }


}