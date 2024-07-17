    // Create shorthands for the relevant APIs.
    const { LineChart,  LabelOrientation } = Spotfire.Dxp.Application.Visuals;
    const { ConnectivityService } = Spotfire.Dxp.Framework.ApplicationModel;
    const { LibraryManager, LibraryItem, LibraryItemType } = Spotfire.Dxp.Framework.Library;
    const { Color } = System.Drawing;

    //colr scheme setting from library to ensure uniformity
    const CHART_TITLE = "Zone Profiles";
    const XAXIS_EXPRESSION = '<[Axis.Default.Names]>';
    const XAXIS_SCALE_ORIENTATION = LabelOrientation.Vertical;
    const YAXIS_EXPRESSION = "[CirclePct.Center], [CirclePct.Donut] , [CirclePct.Edge], [SegmentPct.1],[SegmentPct.2],[SegmentPct.3],[SegmentPct.4],[SegmentPct.5],[SegmentPct.6], [MaskPct.1],  [MaskPct.2], [MaskPct.3], [MaskPct.4], [MaskPct.5], [MaskPct.6], [MaskPct.7], [MaskPct.8], [MaskPct.9]";
    const LINEBYAXIS_EXPRESSION = '<[New Wafer]>';
    const COLORAXIS_EXPRESSION = '<Bin>';
    const WHERECLAUSE_EXPRESSION = `[Bin] >=2`;
    const COLORSCHEME_LIBRARY_PATH = "/Color Schemes/bigwafer_colors";

    /*
* attempts to verify that the Spotfire Analyst client is connected to a Spotfire Server
*
* @param application - the current application context
* @returns true if the client is connected to a server, false otherwise
*/
function checkServerConnection(application: Spotfire.Dxp.Application.AnalysisApplication): boolean {
    const connectivityService = application.GetService(ConnectivityService);
    if (connectivityService == null || !connectivityService)
        return false;
    return connectivityService.IsOnline;
}

/*
* attempts to get a LibraryItem with the given path and type from the Spotfire,
* Library. throws an error if the item is not found.
* 
* @param lm - the LibraryManager to use to look up the item. get with `application.GetService(LibraryManager)`
* @param itemPath - the path to the item in the Library
* @param itemType - the type of the item to look up
* @returns the LibraryItem with the given path and type
*/
function getLibraryItem(
    lm: Spotfire.Dxp.Framework.Library.LibraryManager,
    itemPath: string,
    itemType: Spotfire.Dxp.Framework.Library.LibraryItemType
): Spotfire.Dxp.Framework.Library.LibraryItem {
    const item = OutParam.create(LibraryItem);
    if (!lm.TryGetItem(itemPath, itemType, item.out)) {
        throw new Error(`Library item not found: ${itemPath}`);
    }
    return item;
}
    
    export function createLinechart({ document, application }: CreateLinechartParameters) {
        const page = document.ActivePageReference ?? document.Pages.AddNew();
        const lineChart = page.Visuals.AddNew(LineChart);
        const marking1  = document.Data.Markings.Item.get("Marking");
        const dataManager = document.Data;
        const myDataTable = document.Data.Tables.Item.get("PivotTableCircle");
        lineChart.Data.DataTableReference = myDataTable;
        
        // Proceed with custom configuration.

        lineChart.Title = CHART_TITLE;
        lineChart.XAxis.Expression = XAXIS_EXPRESSION;
        lineChart.XAxis.Scale.LabelOrientation = XAXIS_SCALE_ORIENTATION;
        lineChart.YAxis.Expression = YAXIS_EXPRESSION;
        lineChart.LineByAxis.Expression = LINEBYAXIS_EXPRESSION;
        lineChart.ColorAxis.Expression = COLORAXIS_EXPRESSION;
        lineChart.Data.WhereClauseExpression = WHERECLAUSE_EXPRESSION;
        lineChart.Data.MarkingReference = marking1;
     
        // only proceed if we are connected to a server
        if (checkServerConnection(application)) {
            const libraryManager = application.GetService(LibraryManager);
            if (libraryManager == null || !libraryManager) {
                throw new Error("LibraryManager service not available");
            }
    
            // look up the color scheme at `/bigwafer_colors` in the Spotfire Library
            const libraryColorScheme = getLibraryItem(
                libraryManager,
                COLORSCHEME_LIBRARY_PATH,
                LibraryItemType.ColorScheme
            );
            
            // add the scheme to the local document
            const documentColorScheme = document.ColoringTemplates.AddFromLibrary(libraryColorScheme);
            
            // apply the scheme to the marker layer
            lineChart.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);
        }

    }
    
    RegisterEntryPoint(createLinechart);
