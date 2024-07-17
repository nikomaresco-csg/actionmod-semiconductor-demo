
/*
* evaluates if a Marking with the given name exists in the document
*
* @param document - the current Document context
* @param markingName - the name of the Marking to check for
* @returns true if the Marking exists, false otherwise
*/
export function markingExists(
    document: Spotfire.Dxp.Application.Document,
    markingName: string
): boolean {
    return document.Data.Markings.Contains(markingName);
}

/*
* gets a Marking with the given name, creating it if it doesn't exist
*
* optionally accepts a `markingColor` to set the color of a created Marking. if
*  the Marking already exists, the color will not be changed. if the Marking
*  doesn't exist, and `markingColor` is not specified, the color will be
*  managed by Spotfire.
*
* @param document - the current Document context
* @param markingName - the name of the Marking to get or create
* @param markingColor - optional. the color to set for the Marking
* @returns the Marking with the given name
*/
export function getOrCreateMarking(
    document: Spotfire.Dxp.Application.Document,
    markingName: string,
    markingColor?: System.Drawing.Color
): Spotfire.Dxp.Data.DataMarkingSelection {
    if (markingExists(document, markingName)) {
        return document.Data.Markings.Item.get(markingName)!;
    }
    const marking = document.Data.Markings.Add(markingName);
    if (markingColor !== undefined) {
        marking.Color = markingColor;
    }
    return marking;
}

/*
* creates a new DataTable or replaces an existing one with a "fresh" copy of sourceTable
*
* @param document - Spotfire Document context
* @param tableName - the name of the table to create
* @param sourceTable - the DataTable to copy from
* @returns the new table
*/
export function createOrReplaceDataTable(
    document: Spotfire.Dxp.Application.Document,
    tableName: string,
    sourceTable: Spotfire.Dxp.Data.DataSource
): Spotfire.Dxp.Data.DataTable {
    if (document.Data.Tables.Contains(tableName)) {
        // safe to use ! here since we know the table exists
        const existingTable = document.Data.Tables.Item.get(tableName)!;
        document.Data.Tables.Remove(existingTable);
    }
    const newTable = document.Data.Tables.Add(tableName, sourceTable);
    return newTable;
}

/*
* tries to get a column by name from a data table, throws an error if it doesn't exist
*
* @param dataTable - the data table to search
* @param columnName - the name of the column to find
* @returns the column if it exists
*/
export function getColumn(
    dataTable: Spotfire.Dxp.Data.DataTable,
    columnName: string
): Spotfire.Dxp.Data.DataColumn {
    const col = OutParam.create(Spotfire.Dxp.Data.DataColumn);
    if (!dataTable.Columns.TryGetValue(columnName, col.out))
        throw new Error(`Cannot find column '${columnName}' in table '${dataTable.Name}'.`);
    return col;
}