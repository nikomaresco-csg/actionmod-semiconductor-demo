const { ConnectivityService } = Spotfire.Dxp.Framework.ApplicationModel;
const { MarkerClass, CategoryKey } = Spotfire.Dxp.Application.Visuals;
const { MapChart, MarkerLayerVisualization, Projection } = Spotfire.Dxp.Application.Visuals.Maps;
const { LibraryManager, LibraryItem, LibraryItemType } = Spotfire.Dxp.Framework.Library;


// markings with these names will be created if they don't already exist
const MARKING1_NAME = "Marking";
const MARKING2_NAME = "Marking (2)";

// default values for the wafer map chart

const WAFER_PK_COL_NAME = "New Wafer";

const DIE_X_COL_NAME = "Die X";
const DIE_Y_COL_NAME = "Die Y";

const COLOR_AXIS_COL_NAME = "Bin";

const MAP_TRELLIS_ROWS = 3;
const MAP_TRELLIS_COLS = 7;
const MAP_TITLE = "Wafer bin map";
const MARKER_LAYER_TITLE = "die layer";

const COLORSCHEME_LIBRARY_PATH = "/Big Wafer";


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
/*
* evaluates if a Marking with the given name exists in the document
*
* @param document - the current Document context
* @param markingName - the name of the Marking to check for
* @returns true if the Marking exists, false otherwise
*/
function markingExists(
    document: Spotfire.Dxp.Application.Document,
    markingName: string
): boolean {
    return document.Data.Markings.Contains(markingName);
}

/*
* gets a Marking with the given name, creating it if it doesn't exist
*
* optionally accepts a `markingColor` to set the color of a created Marking. if
*  the Marking already exists, the color will not be changed. if the Marking
*  doesn't exist, and `markingColor` is not specified, the color will be
*  managed by Spotfire.
*
* @param document - the current Document context
* @param markingName - the name of the Marking to get or create
* @param markingColor - optional. the color to set for the Marking
* @returns the Marking with the given name
*/
function getOrCreateMarking(
    document: Spotfire.Dxp.Application.Document,
    markingName: string,
    markingColor?: System.Drawing.Color
): Spotfire.Dxp.Data.DataMarkingSelection {
    if (markingExists(document, markingName)) {
        return document.Data.Markings.Item.get(markingName)!;
    }
    const marking = document.Data.Markings.Add(markingName);
    if (markingColor !== undefined) {
        marking.Color = markingColor;
    }
    return marking;
}

export function createMapchart({
    document,
    application,
}: CreateWaferMapchartParameters) {

    // get the current page, or create a new one if one doesn't exist
    const page = document.ActivePageReference ?? document.Pages.AddNew();
    // get the current data table, or the first one added to the document if one is not active
    const dataTable = document.ActiveDataTableReference ?? Array.from(document.Data.Tables)[0];

    // const marking1 = getOrCreateMarking(document, MARKING1_NAME);
    // const marking2 = getOrCreateMarking(document, MARKING2_NAME);

    // create a new MapChart
    const mapChart = page.Visuals.AddNew(MapChart);
    mapChart.Layers.Clear();

    // set up basic map chart properties
    mapChart.Title = MAP_TITLE;
    mapChart.Projection = Projection.None;
    //mapChart.Legend.Visible = false;

    // create and configure the marking layer
    const markerLayer = OutParam.create(MarkerLayerVisualization);
    mapChart.Layers.AddNewMarkerLayer(dataTable, markerLayer.out);
    markerLayer.AutoConfigure();

    // basic layer properties
    markerLayer.Title = MARKER_LAYER_TITLE;
    markerLayer.MarkerClass = MarkerClass.Tile;
    //markerLayer.MarkerByAxis.Expression = `<[${DIE_X_COL_NAME}] NEST [${DIE_Y_COL_NAME}]>`;

    // for whatever reason, the Projection property doesn't bubble up from
    //  MapChartLayer to MapChartDataLayer/MarkerLayerVisualization, so we have
    //  to get the layer as a regular Layer and set the Projection property there
    const markerLayerAsRegularLayer = mapChart.Layers.Item.get(0)!;
    markerLayerAsRegularLayer.Projection = Projection.None;

    markerLayer.XAxis.Expression=`[${DIE_X_COL_NAME}]`;
    markerLayer.YAxis.Expression=`[${DIE_Y_COL_NAME}]`;

    // set the color axis and set first Bin color to a light gray
    // (keeping this as a fallback in case the library is unavailable)
    markerLayer.ColorAxis.Expression = `<${COLOR_AXIS_COL_NAME}>`;
    const lightGray = System.Drawing.Color.FromArgb(255, 241, 241, 241);
    markerLayer.ColorAxis.Coloring.SetColorForCategory(new CategoryKey(1), lightGray);

    // set up Mmarking behavior
    // markerLayer.Data.MarkingReference = marking2;
    // markerLayer.Data.Filterings.Add(marking1);
    // markerLayer.Data.Filterings.Add(marking2);
    // markerLayer.Data.MarkingCombinationMethod = DataSelectionCombinationMethod.Union;
    // markerLayer.Data.LimitingMarkingsEmptyBehavior = LimitingMarkingsEmptyBehavior.ShowEmpty;

    // this must be set after the markerLayer is created
    // configure trellis properties
    mapChart.Trellis.PanelAxis.Expression = `<[${WAFER_PK_COL_NAME}]>`;
    mapChart.Trellis.ManualLayout = true;
    mapChart.Trellis.ManualRowCount = MAP_TRELLIS_ROWS;
    mapChart.Trellis.ManualColumnCount = MAP_TRELLIS_COLS;

    try {
        const documentColorScheme = getColorSchemeFromDocument(document, "Big Wafer");
        markerLayer.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);

    } catch (noDocumentColorSchemeError) {
        // scheme not found in the document; look in the library instead
        try {
            const libraryColorScheme = getColorSchemeFromLibrary(application, COLORSCHEME_LIBRARY_PATH);
            const documentColorScheme = document.ColoringTemplates.AddFromLibrary(libraryColorScheme);
            markerLayer.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);
        } catch (libraryAccessError) {
            // probably the user is not connected to a server, or the library path is invalid
            // do nothing, the user will have to set the color scheme manually
        }
    }
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
        markerLayer.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);
    }
}

function getColorSchemeFromLibrary(
    application: Spotfire.Dxp.Application.AnalysisApplication,
    libraryPath: string
): Spotfire.Dxp.Framework.Library.LibraryItem {
    if (checkServerConnection(application)) {
        throw new Error("Cannot access library when not connected to a server");
    }

    const libraryManager = application.GetService(LibraryManager);
    if (libraryManager == null || !libraryManager) {
        throw new Error("LibraryManager service not available");
    }

    return getLibraryItem(
        libraryManager,
        libraryPath,
        LibraryItemType.ColorScheme
    );
}

function getColorSchemeFromDocument(
    document: Spotfire.Dxp.Application.Document,
    colorSchemeName: string
): Spotfire.Dxp.Application.Visuals.ConditionalColoring.Coloring {
    return document.ColoringTemplates.Item.get(colorSchemeName)!;
}

RegisterEntryPoint(createMapchart);