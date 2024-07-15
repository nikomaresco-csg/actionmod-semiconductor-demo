const { DataTable, DataColumn, DataColumnSignature, AddColumnsSettings, JoinType,
    DataFlowBuilder, DataSourcePromptMode, DataType, DataRowReaderColumn } = Spotfire.Dxp.Data;
const { PivotTransformation, UnpivotTransformation, ReplaceValuesTransformation,
        AddCalculatedColumnTransformation, ColumnAggregation, ReplaceColumnTransformation } = Spotfire.Dxp.Data.Transformations;
const { DataTableDataSource, ImportContext } = Spotfire.Dxp.Data.Import;
const { Dictionary, List } = System.Collections.Generic;

const STEP1_RESULTNAMINGEXPRESSION = "%V.%C";
const STEP5_RESULTNAMINGEXPRESSION = "%C";

// default values for testing
const D_PRIMARYKEYCOLUMNS = "New Wafer,Bin";
const D_TARGETCOLUMNTITLES = "Circle,Segment,Mask";
const D_TARGETCOLUMNVALUES = "CirclePct,SegmentPct,MaskPct";
const D_TARGETMEASURE = "Avg";
const D_OUTPUTDATATABLENAME = "WaferTransform";

/*
* tries to get a column by name from a data table, throws an error if it doesn't exist
*
* @param dataTable - the data table to search
* @param columnName - the name of the column to find
* @returns the column if it exists
*/
function getColumn(
    dataTable: Spotfire.Dxp.Data.DataTable,
    columnName: string
): Spotfire.Dxp.Data.DataColumn {
    const col = OutParam.create(DataColumn);
    if (!dataTable.Columns.TryGetValue(columnName, col.out))
        throw new Error(`Cannot find column '${columnName}' in table '${dataTable.Name}'.`);
    return col;
}

/*
* zips two arrays together
*
* @param arr1 - the first array
* @param arr2 - the second array
* @returns an array of arrays where each sub-array contains the corresponding elements from the input arrays
*/
function zip(arr1: any[], arr2: any[]): any[] {
    return arr1.map((k, i) => [k, arr2[i]]);
}

/*
* converts a csv string of column names to an array of DataColumns
*
* @param dataTable - the data table to search
* @param columnNameCsv - a csv string of column names to find
* @returns an array of columns
*/
function getColumnsFromCsv(
    dataTable: Spotfire.Dxp.Data.DataTable,
    columnNameCsv: string
): Spotfire.Dxp.Data.DataColumn[] {
    const columnNames = columnNameCsv.split(",");
    const results = columnNames.map(columnName => getColumn(dataTable, columnName));
    return results;
}

/*
* converts an array of DataColumns to an array of DataColumnSignatures
*
* to convert a single DataColumn, use `new DataColumnSignature(dataColumn)`
*
* @param columns - an array of DataColumns to convert
* @returns an array of DataColumnSignatures
*/
function convertDataColumnsToDataSignatures(
    columns: Spotfire.Dxp.Data.DataColumn[]
): Spotfire.Dxp.Data.DataColumnSignature[] {
    return columns.map(col => new DataColumnSignature(col));
}

/*
* creates a new DataTable or replaces an existing one with a "fresh" copy of sourceTable
*
* @param document - Spotfire Document context
* @param tableName - the name of the table to create
* @param sourceTable - the DataTable to copy from
* @returns the new table
*/
function createOrReplaceDataTable(
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

function validateInputs(): boolean {
    // make sure that both column lists contain the same number of values
    return true;
}

/*
* applies a series of transformations to a DataTable
*
* @param importContext - the ImportContext to use. this is typically `application.ImportContext`
* @param sourceDataTable - the DataTable to use as a source for the transformations
* @param pkColumns - an array of DataColumns to use as the primary key
* @param titleColumns - an array of DataColumns to use as category columns
* @param valueColumns - an array of DataColumns to aggregate
* @param targetMeasure - the aggregation method to use
* @returns void
*/
function applyTransformSeries(
    importContext: Spotfire.Dxp.Data.Import.ImportContext,
    dataSource: Spotfire.Dxp.Data.DataSource,
    pkColumns: Spotfire.Dxp.Data.DataColumn[],
    titleColumns: Spotfire.Dxp.Data.DataColumn[],
    valueColumns: Spotfire.Dxp.Data.DataColumn[],
    targetMeasure: string,
): Spotfire.Dxp.Data.DataSource {

    // since we are creating a "virtual" instance of baseDataTable for each iteration, we need to
    //  use a DataFlowBuilder to build the transformation series and apply it to a DataSource,
    //  which will ultimately be used in the Add Columns operation
    const dfb = new DataFlowBuilder(dataSource, importContext);

//1: pivot
    // the first Pivot has to be applied immediately or we won't know which columns
    //  to use during the Unpivot step

    const identityColumnSignatures = convertDataColumnsToDataSignatures(pkColumns);
    const categoryColumnSignatures = convertDataColumnsToDataSignatures(titleColumns);
    const valueColumnSignatures = convertDataColumnsToDataSignatures(valueColumns);

    // we need to convert untyped Javascript arrays to typed arrays that are compatible with .NET
    const identityColumnsList = TypedArray.create(
        DataColumnSignature,
        identityColumnSignatures
    );
    const categoryColumnsList = TypedArray.create(
        DataColumnSignature,
        categoryColumnSignatures
    );

    // first convert the DataColumnSignatures to ColumnAggregations, then create a TypedArray
    const valueColumnsAgg = valueColumnSignatures.map(col => new ColumnAggregation(col, targetMeasure));

    const step1_pivot = new PivotTransformation();
    step1_pivot.IdentityColumns = identityColumnsList;
    step1_pivot.CategoryColumns = categoryColumnsList;
    step1_pivot.ResultNamingExpression = STEP1_RESULTNAMINGEXPRESSION;
    step1_pivot.ValueColumns = TypedArray.create(
        ColumnAggregation,
        valueColumnsAgg
    );

    dfb.AddTransformation(step1_pivot);
    let flow = dfb.Build();
    let reader = dfb.Execute(DataSourcePromptMode.None)

//2: unpivot

    // generate a list of new columns created by the pivot containing all columns except ones ending with ".0"
    const newPivotColumns = Array.from(reader.Columns).filter(
        col => col.Name.startsWith(titleColumns[0].Name) && !col.Name.endsWith(".0")
    );

    const step2_unpivot = new UnpivotTransformation();
    step2_unpivot.CategoryName = "Category";
    step2_unpivot.CategoryType = DataType.String;
    step2_unpivot.ResultName = "Value";
    step2_unpivot.ResultType = DataType.Real;
    step2_unpivot.IdentityColumns = TypedArray.create(
        DataColumnSignature,
        identityColumnSignatures
    );
    step2_unpivot.ValueColumns = TypedArray.create(
        DataColumnSignature,
        newPivotColumns.map(col => new DataColumnSignature(col))
    );

    dfb.AddTransformation(step2_unpivot);
    flow = dfb.Build();
    reader = dfb.Execute(DataSourcePromptMode.None);



//3: replace (Empty) with 0
/*
since the dfb returns a DataFlow, it's not possible to use getColumn to get the new Value column
instead we need to get the DataType for the "Value" column in order to construct a signature
*/
    const valueColumn = OutParam.create(DataRowReaderColumn);
    reader.Columns.TryGetColumn("Value", valueColumn.out)!;
    const valueColumnSignature = new DataColumnSignature(valueColumn);

    const typedValue = OutParam.create(System.Object);
    if (!valueColumn.DataType.Formatter.TryParse("0.0", typedValue.out))
        throw new Error("Cannot parse 0.0 to the correct type for the Value column.");

//??? ReplaceValuesTransformation API doesn't allow for replacing (Empty) with a number
    const step3_replaceValues = new ReplaceValuesTransformation(valueColumnSignature, null, typedValue);

// using a ReplaceColumnTransformation with `SN()` (SubstituteNull) function as a workaround
//const step3_replaceValues = createReplaceColumnTransform(valueColumnSignature, "Value", "Real(SN([Value], 0))");
    dfb.AddTransformation(step3_replaceValues);

//4: add Zone and Area columns
    const step4a_addColumns = new AddCalculatedColumnTransformation("Zone", "Split([Category], '.', 1)");
    const step4b_addColumns = new AddCalculatedColumnTransformation("Area", "Split([Category], '.', 2)");
    dfb.AddTransformation(step4a_addColumns);
    dfb.AddTransformation(step4b_addColumns);

    flow = dfb.Build();
    reader = dfb.Execute(DataSourcePromptMode.None);

//5: pivot back
    // get new Zone and Area columns
    const zoneColumn = OutParam.create(DataRowReaderColumn);
    reader.Columns.TryGetColumn("Zone", zoneColumn.out)!
    const zoneColumnSignature = new DataColumnSignature(zoneColumn);
    const areaColumn = OutParam.create(DataRowReaderColumn);
    reader.Columns.TryGetColumn("Area", areaColumn.out)!;
    const areaColumnSignature = new DataColumnSignature(areaColumn);

    const step5_pivot = new PivotTransformation();
    step5_pivot.IdentityColumns = identityColumnsList;
    step5_pivot.ResultNamingExpression = STEP5_RESULTNAMINGEXPRESSION;
    step5_pivot.CategoryColumns = TypedArray.create(
        DataColumnSignature,
        [zoneColumnSignature, areaColumnSignature]
    );
    step5_pivot.ValueColumns = TypedArray.create(
        ColumnAggregation,
        [new ColumnAggregation(valueColumnSignature, targetMeasure)]
    );

    dfb.AddTransformation(step5_pivot);

    flow = dfb.Build();
    reader = dfb.Execute(DataSourcePromptMode.None);

    return flow;
}

/*
* applies an AddColumns operation to the operationDataTable.
*
* @param operationDataTable - the DataTable to add columns to
* @param sourceDataTable - the DataTable to copy columns from
* @param pkColumns - an array of DataColumns to use as the primary key for the join
* @param ignoredColumns - an array of DataColumns to ignore when adding columns
*/
function applyAddColumns(
    operationDataTable: Spotfire.Dxp.Data.DataTable,
    dataSource: Spotfire.Dxp.Data.DataSource,
    operationPkColumns: Spotfire.Dxp.Data.DataColumn[],
    sourcePkColumns: Spotfire.Dxp.Data.DataColumn[],
    ignoredColumns: Spotfire.Dxp.Data.DataColumnSignature[],
): void {
    const ignoredColumnsList = TypedArray.create(DataColumnSignature, ignoredColumns);

    // get the columns from the source table based on the names of the primary key columns
    // okay to use ! here since we have already validated
    const operationTablePkColumnSignatures = convertDataColumnsToDataSignatures(operationPkColumns);
    const sourceTablePkColumnSignatures = convertDataColumnsToDataSignatures(sourcePkColumns);

    // zip the two sets of signatures into tuple pairs
    const columnMapItems = zip(sourceTablePkColumnSignatures, operationTablePkColumnSignatures);

    // initialize the map and add primary key columns to it in pairs
    const map = new Dictionary(DataColumnSignature, DataColumnSignature);
    columnMapItems.forEach(([sourceCol, operationCol]) => map.Add(sourceCol, operationCol));

    const settings = new AddColumnsSettings(map, JoinType.LeftOuterJoin, ignoredColumnsList);
    operationDataTable.AddColumns(dataSource, settings);
}

export function applyWaferTransform({
    document,
    application,
    baseDataTable,
    primaryKeyColumns,
    targetColumnTitles,
    targetColumnValues,
    targetMeasure,
    outputDataTableName,
}: ApplyWaferTransformParameters) {

    // debug values
    primaryKeyColumns = D_PRIMARYKEYCOLUMNS;
    targetColumnTitles = D_TARGETCOLUMNTITLES;
    targetColumnValues = D_TARGETCOLUMNVALUES;
    targetMeasure = D_TARGETMEASURE;
    outputDataTableName = D_OUTPUTDATATABLENAME;

    const inputsValid = validateInputs();
    if (!inputsValid) {
        throw new Error("Invalid input parameters.")
    }

    const baseDataSource = new DataTableDataSource(baseDataTable);

    // parse columns from csv
    const pkColumns = getColumnsFromCsv(baseDataTable, primaryKeyColumns);
    const titleColumns = getColumnsFromCsv(baseDataTable, targetColumnTitles);
    const valueColumns = getColumnsFromCsv(baseDataTable, targetColumnValues);

        // the first transformation sequence happens on the new operation data table
    // it's okay to use ! here since we have already validated the inputs
    const firstTitleColumn = titleColumns.shift()!;
    const firstValueColumn = valueColumns.shift()!;

    const newDataSource = applyTransformSeries(
        application.ImportContext,
        baseDataSource,
        pkColumns,
        [firstTitleColumn],
        [firstValueColumn],
        targetMeasure
    )

    // create a new data table with the transformations applied
    const operationDataTable = createOrReplaceDataTable(document, outputDataTableName, newDataSource);

    // apply an AddColumns operation followed by our transformation series for each remaining title column
    for (let i = 0; i < titleColumns.length; i++) {

        const titleCol = titleColumns[i];
        const valueCol = valueColumns[i];

        const transformedDataTableDataSource = applyTransformSeries(
            application.ImportContext,
            baseDataSource,
            pkColumns,
            [titleCol],
            [valueCol],
            targetMeasure
        );

        // based on the names of the provided pk columns, look up the corresponding columns in the
        //  source table based on their name
        const sourcePkColumns = pkColumns.map(col => baseDataTable.Columns.Item.get(col.Name)!);

        applyAddColumns(
            operationDataTable,
            transformedDataTableDataSource,
            pkColumns,
            sourcePkColumns,
            [] // no columns to ignore
        )
    }


}

RegisterEntryPoint(applyWaferTransform);