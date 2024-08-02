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

  // src/utils/data.ts
  function markingExists(document, markingName) {
    return document.Data.Markings.Contains(markingName);
  }
  function getOrCreateMarking(document, markingName, markingColor) {
    if (markingExists(document, markingName)) {
      return document.Data.Markings.Item.get(markingName);
    }
    const marking = document.Data.Markings.Add(markingName);
    if (markingColor !== void 0) {
      marking.Color = markingColor;
    }
    return marking;
  }

  // src/scripts/create-linechart.ts
  var { LineChart, LabelOrientation, CategoryKey } = Spotfire.Dxp.Application.Visuals;
  var MARKING_NAME = "Marking";
  var CHART_TITLE = "Zone Profiles";
  var XAXIS_EXPRESSION = "<[Axis.Default.Names]>";
  var XAXIS_SCALE_ORIENTATION = LabelOrientation.Vertical;
  var YAXIS_EXPRESSION = "[CirclePct.Center], [CirclePct.Donut], [CirclePct.Edge], [SegmentPct.1],[SegmentPct.2],[SegmentPct.3],[SegmentPct.4],[SegmentPct.5],[SegmentPct.6], [MaskPct.1],  [MaskPct.2], [MaskPct.3], [MaskPct.4], [MaskPct.5], [MaskPct.6], [MaskPct.7], [MaskPct.8], [MaskPct.9]";
  var LINEBYAXIS_EXPRESSION = "<[Wafer]>";
  var COLORAXIS_EXPRESSION = "<Bin>";
  var COLORSCHEME_NAME = "Bin Wafer Map Colors";
  var COLORSCHEME_PATH = "/public/Demonstrations/Manufacturing/Zone Analysis & Commonality";
  var DATATABLE_NAME = "Zone Profiles";
  function createLinechart({ document, application }) {
    var _a;
    const page = (_a = document.ActivePageReference) != null ? _a : document.Pages.AddNew();
    const dataTable = document.Data.Tables.Item.get(DATATABLE_NAME);
    if (!dataTable) {
      throw new Error(`Data Table not found: ${DATATABLE_NAME}`);
    }
    const lineChart = page.Visuals.AddNew(LineChart);
    lineChart.Title = CHART_TITLE;
    lineChart.Data.DataTableReference = dataTable;
    lineChart.Data.MarkingReference = getOrCreateMarking(document, MARKING_NAME);
    lineChart.XAxis.Expression = XAXIS_EXPRESSION;
    lineChart.XAxis.Scale.LabelOrientation = XAXIS_SCALE_ORIENTATION;
    lineChart.YAxis.Expression = YAXIS_EXPRESSION;
    lineChart.LineByAxis.Expression = LINEBYAXIS_EXPRESSION;
    lineChart.ColorAxis.Expression = COLORAXIS_EXPRESSION;
    const lightGray = System.Drawing.Color.FromArgb(255, 241, 241, 241);
    lineChart.ColorAxis.Coloring.SetColorForCategory(new CategoryKey(1), lightGray);
    try {
      const documentColorScheme = getColorSchemeFromDocument(document, COLORSCHEME_NAME);
      lineChart.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);
    } catch (noDocumentColorSchemeError) {
      try {
        const libraryColorScheme = getColorSchemeFromLibrary(application, `/${COLORSCHEME_PATH}/${COLORSCHEME_NAME}`);
        const documentColorScheme = document.ColoringTemplates.AddFromLibrary(libraryColorScheme);
        lineChart.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);
      } catch (libraryAccessError) {
        try {
          const searchExpression = `type:colorscheme title:"${COLORSCHEME_NAME}"`;
          const results = searchLibrary(application, searchExpression);
          const documentColorScheme = document.ColoringTemplates.AddFromLibrary(Array.from(results)[0]);
          lineChart.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);
        } catch (searchError) {
        }
      }
    }
  }
  RegisterEntryPoint(createLinechart);
})();
//# sourceMappingURL=create-linechart.js.map
