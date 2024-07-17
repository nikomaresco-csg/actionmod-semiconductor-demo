import { getColorSchemeFromDocument, getColorSchemeFromLibrary } from "../utils/library";

const { MarkerClass, CategoryKey } = Spotfire.Dxp.Application.Visuals;
const { MapChart, MarkerLayerVisualization, Projection } = Spotfire.Dxp.Application.Visuals.Maps;


// wafer mapchart configuration
const WAFER_PK_COL_NAME = "New Wafer";
const X_COL_NAME = "Die X";
const Y_COL_NAME = "Die Y";
const COLOR_AXIS_COL_NAME = "Bin";
const MAP_TRELLIS_ROWS = 3;
const MAP_TRELLIS_COLS = 7;
const CHART_TITLE = "Wafer bin map";
const MAP_MARKERLAYER_TITLE = "die layer";

const COLORSCHEME_LIBRARY_PATH = "/Big Wafer";


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
    mapChart.Title = CHART_TITLE;
    mapChart.Projection = Projection.None;
    //mapChart.Legend.Visible = false;

    // create and configure the marking layer
    const markerLayer = OutParam.create(MarkerLayerVisualization);
    mapChart.Layers.AddNewMarkerLayer(dataTable, markerLayer.out);
    markerLayer.AutoConfigure();

    // basic layer properties
    markerLayer.Title = MAP_MARKERLAYER_TITLE;
    markerLayer.MarkerClass = MarkerClass.Tile;
    //markerLayer.MarkerByAxis.Expression = `<[${DIE_X_COL_NAME}] NEST [${DIE_Y_COL_NAME}]>`;

    // for whatever reason, the Projection property doesn't bubble up from
    //  MapChartLayer to MapChartDataLayer/MarkerLayerVisualization, so we have
    //  to get the layer as a regular Layer and set the Projection property there
    const markerLayerAsRegularLayer = mapChart.Layers.Item.get(0)!;
    markerLayerAsRegularLayer.Projection = Projection.None;

    markerLayer.XAxis.Expression=`[${X_COL_NAME}]`;
    markerLayer.YAxis.Expression=`[${Y_COL_NAME}]`;

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
}

RegisterEntryPoint(createMapchart);