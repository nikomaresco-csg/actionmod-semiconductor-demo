"use strict";
(() => {
  // src/scripts/data-function.ts
  var { HierarchicalClusteringSettings } = Spotfire.Dxp.Data.Computations.Clustering;
  var { DataFunction, InputParameter, OutputParameter } = Spotfire.Dxp.Data.DataFunctions;
  var { DataManager, DataType } = Spotfire.Dxp.Data;
  function executeDataFunctionByName(document, dataFunctionName, executeSynchronously = true) {
    const dataFunctionCollection = Array.from(document.Data.DataFunctions);
    const dataFunction = dataFunctionCollection.find((df) => df.Name === dataFunctionName);
    if (dataFunction != null)
      if (executeSynchronously)
        dataFunction.ExecuteSynchronously();
      else
        dataFunction.Execute();
    else
      throw new Error(`Data Function with name ${dataFunctionName} not found`);
  }
  function triggerDataFunction({
    document,
    dataFunctionName
  }) {
    executeDataFunctionByName(document, dataFunctionName);
  }
  RegisterEntryPoint(triggerDataFunction);
})();
//# sourceMappingURL=data-function.js.map
