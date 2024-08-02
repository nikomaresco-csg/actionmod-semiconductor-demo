"use strict";
(() => {
  // src/scripts/data-science.ts
  var { HierarchicalClusteringSettings } = Spotfire.Dxp.Data.Computations.Clustering;
  var { DataFunction, InputParameter, OutputParameter } = Spotfire.Dxp.Data.DataFunctions;
  var { DataManager, DataType } = Spotfire.Dxp.Data;
  function triggerDataFunction({
    document,
    dataFunctionName
  }) {
    const dataFunctionCollection = Array.from(document.Data.DataFunctions);
    const dataFunction = dataFunctionCollection.find((df) => df.Name === dataFunctionName);
    if (dataFunction != null)
      dataFunction.ExecuteSynchronously();
    else
      throw new Error(`Data Function with name ${dataFunctionName} not found`);
  }
})();
//# sourceMappingURL=data-science.js.map
