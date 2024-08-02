"use strict";
(() => {
  // src/utils/library.ts
  function checkServerConnection(application) {
    const connectivityService = application.GetService(
      Spotfire.Dxp.Framework.ApplicationModel.ConnectivityService
    );
    if (connectivityService == null || !connectivityService)
      return false;
    return connectivityService.IsOnline;
  }
  function getLibraryItem(lm, itemPath, itemType) {
    const item = OutParam.create(Spotfire.Dxp.Framework.Library.LibraryItem);
    if (!lm.TryGetItem(itemPath, itemType, item.out)) {
      throw new Error(`Library item not found: ${itemPath}`);
    }
    return item;
  }
  function getColorSchemeFromLibrary(application, libraryPath) {
    if (!checkServerConnection(application)) {
      throw new Error("Cannot access library when not connected to a server");
    }
    const libraryManager = application.GetService(Spotfire.Dxp.Framework.Library.LibraryManager);
    if (libraryManager == null || !libraryManager) {
      throw new Error("LibraryManager service not available");
    }
    return getLibraryItem(
      libraryManager,
      libraryPath,
      Spotfire.Dxp.Framework.Library.LibraryItemType.ColorScheme
    );
  }
  function getColorSchemeFromDocument(document, colorSchemeName) {
    return document.ColoringTemplates.Item.get(colorSchemeName);
  }
  function searchLibrary(application, searchExpression) {
    if (!checkServerConnection(application)) {
      throw new Error("Cannot access library when not connected to a server");
    }
    const libraryManager = application.GetService(Spotfire.Dxp.Framework.Library.LibraryManager);
    if (libraryManager == null || !libraryManager) {
      throw new Error("LibraryManager service not available");
    }
    return libraryManager.Search(
      searchExpression,
      Spotfire.Dxp.Framework.Library.LibraryItemRetrievalOption.IncludePath
    );
  }

  // src/scripts/wafer-mapchart.ts
  var { MarkerClass, CategoryKey } = Spotfire.Dxp.Application.Visuals;
  var { MapChart, MarkerLayerVisualization, Projection } = Spotfire.Dxp.Application.Visuals.Maps;
  var XAXIS_EXPRESSION = "[Die X]";
  var YAXIS_EXPRESSION = "[Die Y]";
  var COLORAXIS_EXPRESSION = "Bin";
  var TRELLIS_PANEL_EXPRESSION = "<[Wafer]>";
  var TRELLIS_ROWS_COUNT = 3;
  var TRELLIS_COLS_COUNT = 7;
  var CHART_TITLE = "Wafer bin map";
  var MAP_MARKERLAYER_TITLE = "die layer";
  var COLORSCHEME_NAME = "Bin Wafer Map Colors";
  var COLORSCHEME_PATH = "/public/Demonstrations/Manufacturing/Zone Analysis & Commonality";
  var DATATABLE_NAME = "Big Wafer";
  function createMapchart({
    document,
    application
  }) {
    var _a;
    const page = (_a = document.ActivePageReference) != null ? _a : document.Pages.AddNew();
    const dataTable = document.Data.Tables.Item.get(DATATABLE_NAME);
    if (!dataTable) {
      throw new Error(`Data Table not found: ${DATATABLE_NAME}`);
    }
    const mapChart = page.Visuals.AddNew(MapChart);
    mapChart.Layers.Clear();
    mapChart.Title = CHART_TITLE;
    mapChart.Projection = Projection.None;
    const markerLayer = OutParam.create(MarkerLayerVisualization);
    mapChart.Layers.AddNewMarkerLayer(dataTable, markerLayer.out);
    markerLayer.AutoConfigure();
    markerLayer.Title = MAP_MARKERLAYER_TITLE;
    markerLayer.MarkerClass = MarkerClass.Tile;
    const markerLayerAsRegularLayer = mapChart.Layers.Item.get(0);
    markerLayerAsRegularLayer.Projection = Projection.None;
    markerLayer.XAxis.Expression = XAXIS_EXPRESSION;
    markerLayer.YAxis.Expression = YAXIS_EXPRESSION;
    markerLayer.ColorAxis.Coloring.Clear();
    markerLayer.ColorAxis.Expression = COLORAXIS_EXPRESSION;
    const lightGray = System.Drawing.Color.FromArgb(255, 241, 241, 241);
    markerLayer.ColorAxis.Coloring.SetColorForCategory(new CategoryKey(1), lightGray);
    mapChart.Trellis.PanelAxis.Expression = TRELLIS_PANEL_EXPRESSION;
    mapChart.Trellis.ManualLayout = true;
    mapChart.Trellis.ManualRowCount = TRELLIS_ROWS_COUNT;
    mapChart.Trellis.ManualColumnCount = TRELLIS_COLS_COUNT;
    try {
      const documentColorScheme = getColorSchemeFromDocument(document, COLORSCHEME_NAME);
      markerLayer.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);
    } catch (noDocumentColorSchemeError) {
      try {
        const libraryColorScheme = getColorSchemeFromLibrary(application, `${COLORSCHEME_PATH}/${COLORSCHEME_NAME}`);
        const documentColorScheme = document.ColoringTemplates.AddFromLibrary(libraryColorScheme);
        markerLayer.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);
      } catch (libraryAccessError) {
        try {
          const searchExpression = `type:colorscheme title:"${COLORSCHEME_NAME}"`;
          const results = searchLibrary(application, searchExpression);
          const documentColorScheme = document.ColoringTemplates.AddFromLibrary(Array.from(results)[0]);
          markerLayer.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);
        } catch (searchError) {
        }
      }
    }
  }
  RegisterEntryPoint(createMapchart);
})();
//# sourceMappingURL=wafer-mapchart.js.map
