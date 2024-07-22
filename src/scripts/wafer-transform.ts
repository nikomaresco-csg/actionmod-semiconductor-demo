import { getColumn, createOrReplaceDataTable } from "../utils/data";

const { DataColumnSignature, AddColumnsSettings, JoinType, DataFlowBuilder, 
    DataSourcePromptMode, DataType, DataRowReaderColumn } = Spotfire.Dxp.Data;
const { PivotTransformation, UnpivotTransformation, ReplaceValuesTransformation,
    AddCalculatedColumnTransformation, ColumnAggregation } = Spotfire.Dxp.Data.Transformations;
const { DataTableDataSource } = Spotfire.Dxp.Data.Import;
const { Dictionary } = System.Collections.Generic;


// result naming expressions for pivot and transformations
const STEP1_RESULTNAMINGEXPRESSION = "%V.%C";
const STEP5_RESULTNAMINGEXPRESSION = "%C";

// default values for the wafer transform
// storing them as constants because it's too cumbersome to input column names in the current UI
const IDENTITY_COLUMNS = "Wafer,Bin,Lot";
const COLUMN_TITLES = "Circle,Segment,Mask";
const COLUMN_VALUES = "CirclePct,SegmentPct,MaskPct";
const AGGREGATION = "Avg";
const OUTPUT_TABLE_NAME = "Zone Profiles";


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

//1: add percentage column
    const colname = titleColumns[0].Name;
    const colname_pct = `${titleColumns[0].Name}Pct`;
    const step1_addColumns = new AddCalculatedColumnTransformation(
        colname_pct,
        `Count() OVER ([Lot], [Wafer], [${colname}], [Bin]) / Count() OVER ([Lot], [Wafer], [${colname}])`
    )
    dfb.AddTransformation(step1_addColumns);
    let flow = dfb.Build();
    let reader = dfb.Execute(DataSourcePromptMode.None);

//2: pivot
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

    const step2_pivot = new PivotTransformation();
    step2_pivot.IdentityColumns = identityColumnsList;
    step2_pivot.CategoryColumns = categoryColumnsList;
    step2_pivot.ResultNamingExpression = STEP1_RESULTNAMINGEXPRESSION;
    step2_pivot.ValueColumns = TypedArray.create(
        ColumnAggregation,
        valueColumnsAgg
    );

    dfb.AddTransformation(step2_pivot);
    flow = dfb.Build();
    reader = dfb.Execute(DataSourcePromptMode.None);

//3: unpivot

    // generate a list of new columns created by the pivot containing all columns except ones ending with ".0"
    const newPivotColumns = Array.from(reader.Columns).filter(
        col => col.Name.startsWith(titleColumns[0].Name) && !col.Name.endsWith(".0")
    );

    const step3_unpivot = new UnpivotTransformation();
    step3_unpivot.CategoryName = "Category";
    step3_unpivot.CategoryType = DataType.String;
    step3_unpivot.ResultName = "Value";
    step3_unpivot.ResultType = DataType.Real;
    step3_unpivot.IdentityColumns = TypedArray.create(
        DataColumnSignature,
        identityColumnSignatures
    );
    step3_unpivot.ValueColumns = TypedArray.create(
        DataColumnSignature,
        newPivotColumns.map(col => new DataColumnSignature(col))
    );

    dfb.AddTransformation(step3_unpivot);
    flow = dfb.Build();
    reader = dfb.Execute(DataSourcePromptMode.None);

//4: replace (Empty) with 0
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

    const step4_replaceValues = new ReplaceValuesTransformation(valueColumnSignature, null, typedValue);

// using a ReplaceColumnTransformation with `SN()` (SubstituteNull) function as a workaround
//const step3_replaceValues = createReplaceColumnTransform(valueColumnSignature, "Value", "Real(SN([Value], 0))");
    dfb.AddTransformation(step4_replaceValues);

//5: add Zone and Area columns
    const step5a_addColumns = new AddCalculatedColumnTransformation(
        "Zone",
        "Split([Category], '.', 1)"
    );
    const step5b_addColumns = new AddCalculatedColumnTransformation(
        "Area",
        "Split([Category], '.', 2)"
    );
    dfb.AddTransformation(step5a_addColumns);
    dfb.AddTransformation(step5b_addColumns);

    flow = dfb.Build();
    reader = dfb.Execute(DataSourcePromptMode.None);

//6: pivot back
    // get new Zone and Area columns
    const zoneColumn = OutParam.create(DataRowReaderColumn);
    reader.Columns.TryGetColumn("Zone", zoneColumn.out)!
    const zoneColumnSignature = new DataColumnSignature(zoneColumn);
    const areaColumn = OutParam.create(DataRowReaderColumn);
    reader.Columns.TryGetColumn("Area", areaColumn.out)!;
    const areaColumnSignature = new DataColumnSignature(areaColumn);

    const step6_pivot = new PivotTransformation();
    step6_pivot.IdentityColumns = identityColumnsList;
    step6_pivot.ResultNamingExpression = STEP5_RESULTNAMINGEXPRESSION;
    step6_pivot.CategoryColumns = TypedArray.create(
        DataColumnSignature,
        [zoneColumnSignature, areaColumnSignature]
    );
    step6_pivot.ValueColumns = TypedArray.create(
        ColumnAggregation,
        [new ColumnAggregation(valueColumnSignature, targetMeasure)]
    );

    dfb.AddTransformation(step6_pivot);

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
    /*
    primaryKeyColumns,
    targetColumnTitles,
    targetColumnValues,
    targetMeasure,
    outputDataTableName,
    */
}: ApplyWaferTransformParameters) {

    // debug values
    const primaryKeyColumns = IDENTITY_COLUMNS;
    const targetColumnTitles = COLUMN_TITLES;
    const targetColumnValues = COLUMN_VALUES;
    const targetMeasure = AGGREGATION;
    const outputDataTableName = OUTPUT_TABLE_NAME;

    const baseDataSource = new DataTableDataSource(baseDataTable);

    // parse columns from csv
    const pkColumns = getColumnsFromCsv(baseDataTable, primaryKeyColumns);
    const titleColumns = getColumnsFromCsv(baseDataTable, targetColumnTitles);
    const valueColumns = getColumnsFromCsv(baseDataTable, targetColumnValues);

//TODO: this can probably be squeezed into the loop below
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