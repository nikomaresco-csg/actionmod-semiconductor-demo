// This file is auto-generated and will be overwritten on build.
/// <reference types="@spotfire/mods-api/action-mods/api.d.ts" />

interface ApplyWaferTransformParameters {
    /** The loaded {@link Spotfire.Dxp.Application.Document}. */
    document: Spotfire.Dxp.Application.Document;

    /** The current {@link Spotfire.Dxp.Application.AnalysisApplication}. */
    application: Spotfire.Dxp.Application.AnalysisApplication;

    /** The data table to transform */
    baseDataTable: DataTable;

    /** Comma-separated list of column names that make up the primary key */
    primaryKeyColumns: string;

    /** Comma-separated list of column titles to use as the target columns. Must have same number of items as targetColumnValues */
    targetColumnTitles: string;

    /** Comma-separated list of column values to use as the target columns. Must have same number of items as targetColumnNames */
    targetColumnValues: string;

    /** The aggregate measure to use on the target columns */
    targetMeasure: string;

    /** The name of data table that will be created as a result of the transformations */
    outputDataTableName: string;
}

interface TriggerDataFunctionParameters {
    /** The loaded {@link Spotfire.Dxp.Application.Document}. */
    document: Spotfire.Dxp.Application.Document;

    /** The current {@link Spotfire.Dxp.Application.AnalysisApplication}. */
    application: Spotfire.Dxp.Application.AnalysisApplication;

    /** The name of the Data Function to execute */
    dataFunctionName: string;
}

interface CreateWaferMapchartParameters {
    /** The loaded {@link Spotfire.Dxp.Application.Document}. */
    document: Spotfire.Dxp.Application.Document;

    /** The current {@link Spotfire.Dxp.Application.AnalysisApplication}. */
    application: Spotfire.Dxp.Application.AnalysisApplication;
}
