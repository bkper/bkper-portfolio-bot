# Bkper Stock Bot

A Bkper Bot that automatically manages inventory instruments across Financial Books by maintaining synchronized quantities and calculating realized results in a dedicated Stock Book.

![Stock Bot](https://docs.google.com/drawings/d/e/2PACX-1vQSjFxT6jVtwaiuDOEaDOaruFHWDp8YtT91lNUCw4BruKm3ZED__g1D4-5iAoi-J23j4v55Tk6ETg9R/pub?w=2848&h=1306)


## Overview

The Stock Bot monitors transactions in Financial Books and automatically tracks quantities of traded instruments in a separate Stock Book. Key features include:

- Automatic synchronization between Financial Books and the Stock Book.
- [Realized Results](#realized-results-service) tracking using the FIFO method.
- Support for both [Historical Cost and Mark-To-Market accounting](https://www.investopedia.com/ask/answers/042315/how-market-market-accounting-different-historical-cost-accounting.asp).
- Handling of fees, interests, and multiple exchange rates.
- Period closing support with [Forward Date](#forward-date-service) functionality.


## Configuration

To configure the Bkper Stock Bot, ensure the following setup:

### Collection:
   - Both Financial and Instruments Books must reside within the same [Collection](https://help.bkper.com/en/articles/4208937-collections).
   - Define a single Instruments Book per Collection. This book is identified by either:
     - Setting the **decimal places to 0 (zero)** in the book settings, or
     - Setting the `stock_book` property to `true`.

### Base Book (optional):
   - Optionally, you can define a single Base Book per Collection for tracking realized exchange results separately. Refer to the [Realized Results Service](#realized-results-service) for more details.
   - The Base Book is identified by setting the `exc_base` property to `true`.

### Properties Interactions:

   The Stock Bot interacts with various properties to manage and synchronize data effectively. Ensure these properties are correctly set in your books for optimal performance.

   **Book Properties**:
   - **Financial Books**:
     - `exc_code`: **Required** - The exchange code representing the book currency.
   - **Instruments Book**:
     - `stock_book`: **Optional** - true/false - Identifies the Instruments book of the collection. If not present, decimal places must be set to 0 (zero) in the book settings.
     - `stock_historical`: **Optional** - true/false - Defines if realized results calculations should consider **only** historical costs and rates.
     - `stock_fair`: **Optional** - true/false - Defines if realized results calculations should consider **only** fair costs and rates.

     **Observations:**
     If neither `stock_historical` nor `stock_fair` properties are set, calculations will consider **both** historical and fair basis. For more information, check out this article on [Mark-To-Market vs. Historical Cost accounting](https://www.investopedia.com/ask/answers/042315/how-market-market-accounting-different-historical-cost-accounting.asp).

   **Group Properties**:
   - `stock_exc_code`: **Required** - Defines the exchange code representing the currency of the instrument that will have quantities mirrored into the Stock Book. Only transactions from/to accounts within groups with the `stock_exc_code` property set will be mirrored.

   **Account Properties**:
   - `stock_fees_account`: **Optional** - The fees account used by the broker account. The broker account is identified by having an associated fees account.

   **Transaction Properties**:
   - `instrument`: **Required** - The instrument name or ticker.
   - `quantity`: **Required** - The quantity of the instrument stock operation to track.
   - `trade_date`: **Required** - The date of the stock operation.
   - `order`: **Optional** - The order of the operation, if multiple operations happened in the same day.
   - `fees`: **Optional** - The value included in the transaction amount corresponding to fees.
   - `interest`: **Optional** - The value included in the transaction amount corresponding to interests.
   - `cost_hist`: **Optional** - The amount representing the historical cost of the transaction. This property is necessary only if calculating realized results in **both** historical and fair basis.
   - `cost_base`: **Optional** - The amount representing the cost of the transaction in the base currency. Providing a `cost_base` effectively fixes a specific exchange rate for the operation, as it determines a unique ratio between the instrument currency and the base currency.
   - `cost_hist_base`: **Optional** - The amount representing the historical cost of the transaction in the base currency. Providing a `cost_hist_base` also fixes a specific historical exchange rate for the operation. This property is necessary only if calculating realized results in **both** historical and fair basis.

   **Observations:**
   Neither `cost_base` nor `cost_hist_base` properties are necessary if there is no Base Book defined in the collection.


## Realized Results Service

The Stock Bot uses the FIFO ([First-In, First-Out](https://medium.com/magnimetrics/first-in-first-out-fifo-inventory-costing-f0bc00096a59)) method to calculate realized results, ensuring accurate tracking of gains and losses.

### Key Features:

- **Realized Results Tracking**: Accurately tracks gains and losses from trade operations using the FIFO method. The Stock Bot records these results in both the Instruments and Financial Books, and if a Base Book is defined, it separates realized exchange results from stock market results.

- **Mark-to-Market Valuation**: Optionally, the Stock Bot can automatically adjust the market value of remaining instruments in Financial Books to match the last realized price. This procedure is known as [Mark-To-Market](https://www.investopedia.com/terms/m/marktomarket.asp). It is particularly useful for liquidated Bonds instruments, where the Stock Bot can also adjust associated Interest accounts.

**Important:**
The Stock Bot automatically adds properties to transactions in the Instruments Book when calculating realized results. These properties are used for state and log control. It also manages trade states by checking/unchecking transactions (see [Transaction States](https://help.bkper.com/en/articles/2569149-transaction-status)). These properties and states **must not** be manually altered.


## Forward Date Service

To [close a period](https://help.bkper.com/en/articles/6000644-closing-a-period) and [set a closing date](https://help.bkper.com/en/articles/5100445-book-closing-and-lock-dates) for the Stock Book, instruments must be carried forward to the next period by setting a Forward Date in the Instruments Book.

Each unprocessed transaction will have its date, price, and exchange rate updated to the current valuation, while retaining a log of its previous state. Once the last instrument is forwarded, a closing date is set on the Stock Book one day before the Forward Date.

After forwarding, future FIFO calculations will use the new Forward valuation. To calculate gains/losses solely on a historical basis, ensure the `stock_historical` property is set to `true` in the Instruments Book.

**Important:**
The Stock Bot automatically adds properties to transactions in the Instruments Book during the forwarding process. These properties are used for state and log control and **must not** be manually altered.
