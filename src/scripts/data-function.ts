const { HierarchicalClusteringSettings } = Spotfire.Dxp.Data.Computations.Clustering;
const { DataFunction, InputParameter, OutputParameter } = Spotfire.Dxp.Data.DataFunctions;
const { DataManager, DataType } = Spotfire.Dxp.Data;


/*
* looks up a Data Function in the current document by its name and executes it
*
* @param document - the current document
* @param dataFunctionName - the name of the Data Function to execute
* @param executeSynchronously - whether to execute the Data Function synchronously or not
*/
function executeDataFunctionByName(
    document: Spotfire.Dxp.Application.Document,
    dataFunctionName: string,
    executeSynchronously: boolean = true,
) {
    const dataFunctionCollection = Array.from(document.Data.DataFunctions);
    const dataFunction = dataFunctionCollection.find(df => df.Name === dataFunctionName);

    if (dataFunction != null)
        if (executeSynchronously)
            dataFunction.ExecuteSynchronously();
        else
            dataFunction.Execute();
    else
        throw new Error(`Data Function with name ${dataFunctionName} not found`);
}

export function triggerDataFunction({
    document,
    dataFunctionName,
}: TriggerDataFunctionParameters) {

    executeDataFunctionByName(document, dataFunctionName);
}

RegisterEntryPoint(triggerDataFunction);

/*
it's currently not possible to build Data Functions with Action Mods because the
Spotfire.Dxp.Data.DataFunctions.DataFunctionBuilder API is not exposed in the
Action Mods API.

but if you could it would probably look something like below.

see C#/Python API doc for more details:
https://docs.tibco.com/pub/doc_remote/sfire_dev/area/doc/api/TIB_sfire-analyst_api/html/N_Spotfire_Dxp_Data_DataFunctions.htm
*/
/*
const { DataFunctionBuilder, DataFunctionExecutorTypeIdentifiers, ParameterType,
    InputParamBuilder, OutputParamBuilder, PropertyOutputBuilder } = Spotfire.Dxp.Data.DataFunctions;
const { DataPropertyClass, DataManager } = Spotfire.Dxp.Data.;

// DataFunctionBuilder is a "factory" class for DataFunction objects
const dfBuilder = DataFunctionBuilder(
    "data function name",
    DataFunctionExecutorTypeIdentifiers.PythonScriptExecutor
);

const pythonScript = "output = input * 2";
dfBuilder.Settings["Script"] = pythonScript;

// similarly, InputParamBuilder and OutputParamBuilder are "factory" classes for parameters
const inputParam = InputParamBuilder("input", ParameterType.Value).Build();
dfBuilder.InputParameters.Add(inputParam);

const outputParam = OutputParamBuilder("output", ParameterType.Value).Build();
dfBuilder.OutputParameters.Add(outputParam);

// construct a DataFunctionDefinition object
const dfDefinition = dfBuilder.Build();

const dataFunction = document.Data.DataFunctions.AddNew("data function name", dfDefinition);
dataFunction.UpdateBehavior = DataFunctionUpdateBehavior.Manual;
dataFunction.Visible = true;
dataFunction.Inputs.SetInput(inputParam, 1);

// represents a Document Property output
const propertyOutputBuilder = PropertyOutputBuilder.CreateDocumentPropertyOutput("outputDocProp", DataManager).Build();
dataFunction.Outputs.SetPropertyOutput(outputParam, propertyOutput);

dataFunction.ExecuteSynchronously();
*/