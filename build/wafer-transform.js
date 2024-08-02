"use strict";
(() => {
  // src/utils/data.ts
  function createOrReplaceDataTable(document, tableName, sourceTable) {
    if (document.Data.Tables.Contains(tableName)) {
      const existingTable = document.Data.Tables.Item.get(tableName);
      document.Data.Tables.Remove(existingTable);
    }
    const newTable = document.Data.Tables.Add(tableName, sourceTable);
    return newTable;
  }
  function getColumn(dataTable, columnName) {
    const col = OutParam.create(Spotfire.Dxp.Data.DataColumn);
    if (!dataTable.Columns.TryGetValue(columnName, col.out))
      throw new Error(`Cannot find column '${columnName}' in table '${dataTable.Name}'.`);
    return col;
  }

  // src/scripts/wafer-transform.ts
  var {
    DataColumnSignature,
    AddColumnsSettings,
    JoinType,
    DataFlowBuilder,
    DataSourcePromptMode,
    DataType,
    DataRowReaderColumn
  } = Spotfire.Dxp.Data;
  var {
    PivotTransformation,
    UnpivotTransformation,
    ReplaceValuesTransformation,
    AddCalculatedColumnTransformation,
    ColumnAggregation
  } = Spotfire.Dxp.Data.Transformations;
  var { DataTableDataSource } = Spotfire.Dxp.Data.Import;
  var { Dictionary } = System.Collections.Generic;
  var STEP1_RESULTNAMINGEXPRESSION = "%V.%C";
  var STEP5_RESULTNAMINGEXPRESSION = "%C";
  var IDENTITY_COLUMNS = "Wafer,Bin,Lot";
  var COLUMN_TITLES = "Circle,Segment,Mask";
  var COLUMN_VALUES = "CirclePct,SegmentPct,MaskPct";
  var AGGREGATION = "Avg";
  var OUTPUT_TABLE_NAME = "Zone Profiles";
  function zip(arr1, arr2) {
    return arr1.map((k, i) => [k, arr2[i]]);
  }
  function getColumnsFromCsv(dataTable, columnNameCsv) {
    const columnNames = columnNameCsv.split(",");
    const results = columnNames.map((columnName) => getColumn(dataTable, columnName));
    return results;
  }
  function convertDataColumnsToDataSignatures(columns) {
    return columns.map((col) => new DataColumnSignature(col));
  }
  function applyTransformSeries(importContext, dataSource, pkColumns, titleColumns, targetMeasure) {
    const dfb = new DataFlowBuilder(dataSource, importContext);
    const colname = titleColumns[0].Name;
    const colname_pct = `${titleColumns[0].Name}Pct`;
    const step1_addColumns = new AddCalculatedColumnTransformation(
      colname_pct,
      `Count() OVER ([Lot], [Wafer], [${colname}], [Bin]) / Count() OVER ([Lot], [Wafer], [${colname}])`
    );
    dfb.AddTransformation(step1_addColumns);
    let flow = dfb.Build();
    let reader = dfb.Execute(DataSourcePromptMode.None);
    const identityColumnSignatures = convertDataColumnsToDataSignatures(pkColumns);
    const categoryColumnSignatures = convertDataColumnsToDataSignatures(titleColumns);
    const pctColumn = OutParam.create(DataRowReaderColumn);
    reader.Columns.TryGetColumn(colname_pct, pctColumn.out);
    const pctColumnSignature = new DataColumnSignature(pctColumn);
    const identityColumnsList = TypedArray.create(
      DataColumnSignature,
      identityColumnSignatures
    );
    const categoryColumnsList = TypedArray.create(
      DataColumnSignature,
      categoryColumnSignatures
    );
    const valueColumnsAgg = new ColumnAggregation(pctColumnSignature, targetMeasure);
    const step2_pivot = new PivotTransformation();
    step2_pivot.IdentityColumns = identityColumnsList;
    step2_pivot.CategoryColumns = categoryColumnsList;
    step2_pivot.ResultNamingExpression = STEP1_RESULTNAMINGEXPRESSION;
    step2_pivot.ValueColumns = TypedArray.create(
      ColumnAggregation,
      [valueColumnsAgg]
    );
    dfb.AddTransformation(step2_pivot);
    flow = dfb.Build();
    reader = dfb.Execute(DataSourcePromptMode.None);
    const newPivotColumns = Array.from(reader.Columns).filter(
      (col) => col.Name.startsWith(titleColumns[0].Name) && !col.Name.endsWith(".0")
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
      newPivotColumns.map((col) => new DataColumnSignature(col))
    );
    dfb.AddTransformation(step3_unpivot);
    flow = dfb.Build();
    reader = dfb.Execute(DataSourcePromptMode.None);
    const valueColumn = OutParam.create(DataRowReaderColumn);
    reader.Columns.TryGetColumn("Value", valueColumn.out);
    const valueColumnSignature = new DataColumnSignature(valueColumn);
    const typedValue = OutParam.create(System.Object);
    if (!valueColumn.DataType.Formatter.TryParse("0.0", typedValue.out))
      throw new Error("Cannot parse 0.0 to the correct type for the Value column.");
    const step4_replaceValues = new ReplaceValuesTransformation(valueColumnSignature, null, typedValue);
    dfb.AddTransformation(step4_replaceValues);
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
    const zoneColumn = OutParam.create(DataRowReaderColumn);
    reader.Columns.TryGetColumn("Zone", zoneColumn.out);
    const zoneColumnSignature = new DataColumnSignature(zoneColumn);
    const areaColumn = OutParam.create(DataRowReaderColumn);
    reader.Columns.TryGetColumn("Area", areaColumn.out);
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
  function applyAddColumns(operationDataTable, dataSource, operationPkColumns, sourcePkColumns, ignoredColumns) {
    const ignoredColumnsList = TypedArray.create(DataColumnSignature, ignoredColumns);
    const operationTablePkColumnSignatures = convertDataColumnsToDataSignatures(operationPkColumns);
    const sourceTablePkColumnSignatures = convertDataColumnsToDataSignatures(sourcePkColumns);
    const columnMapItems = zip(sourceTablePkColumnSignatures, operationTablePkColumnSignatures);
    const map = new Dictionary(DataColumnSignature, DataColumnSignature);
    columnMapItems.forEach(([sourceCol, operationCol]) => map.Add(sourceCol, operationCol));
    const settings = new AddColumnsSettings(map, JoinType.LeftOuterJoin, ignoredColumnsList);
    operationDataTable.AddColumns(dataSource, settings);
  }
  function applyWaferTransform({
    document,
    application,
    baseDataTable
  }) {
    const primaryKeyColumns = IDENTITY_COLUMNS;
    const targetColumnTitles = COLUMN_TITLES;
    const targetColumnValues = COLUMN_VALUES;
    const targetMeasure = AGGREGATION;
    const outputDataTableName = OUTPUT_TABLE_NAME;
    const baseDataSource = new DataTableDataSource(baseDataTable);
    const pkColumns = getColumnsFromCsv(baseDataTable, primaryKeyColumns);
    const titleColumns = getColumnsFromCsv(baseDataTable, targetColumnTitles);
    const firstTitleColumn = titleColumns.shift();
    const newDataSource = applyTransformSeries(
      application.ImportContext,
      baseDataSource,
      pkColumns,
      [firstTitleColumn],
      targetMeasure
    );
    const operationDataTable = createOrReplaceDataTable(document, outputDataTableName, newDataSource);
    for (let i = 0; i < titleColumns.length; i++) {
      const titleCol = titleColumns[i];
      const transformedDataTableDataSource = applyTransformSeries(
        application.ImportContext,
        baseDataSource,
        pkColumns,
        [titleCol],
        targetMeasure
      );
      const sourcePkColumns = pkColumns.map((col) => baseDataTable.Columns.Item.get(col.Name));
      applyAddColumns(
        operationDataTable,
        transformedDataTableDataSource,
        pkColumns,
        sourcePkColumns,
        []
        // no columns to ignore
      );
    }
  }
  RegisterEntryPoint(applyWaferTransform);
})();
//# sourceMappingURL=wafer-transform.js.map
