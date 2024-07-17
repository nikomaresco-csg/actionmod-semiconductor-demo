import { getColorSchemeFromDocument, getColorSchemeFromLibrary } from "../utils/library";

const { MarkerClass, CategoryKey } = Spotfire.Dxp.Application.Visuals;
const { MapChart, MarkerLayerVisualization, Projection } = Spotfire.Dxp.Application.Visuals.Maps;


// wafer mapchart configuration
const XAXIS_EXPRESSION = "[Die X]";
const YAXIS_EXPRESSION = "[Die Y]";
const COLORAXIS_EXPRESSION = "Bin";
const TRELLIS_PANEL_EXPRESSION = "[New Wafer]";
const TRELLIS_ROWS_COUNT = 3;
const TRELLIS_COLS_COUNT = 7;
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

    // create a new MapChart
    const mapChart = page.Visuals.AddNew(MapChart);
    mapChart.Layers.Clear();

    mapChart.Title = CHART_TITLE;
    mapChart.Projection = Projection.None;

    // create and configure a marking layer
    const markerLayer = OutParam.create(MarkerLayerVisualization);
    mapChart.Layers.AddNewMarkerLayer(dataTable, markerLayer.out);
    // need to autoconfigure or the layer will behave unexpectedly
    markerLayer.AutoConfigure();

    markerLayer.Title = MAP_MARKERLAYER_TITLE;
    markerLayer.MarkerClass = MarkerClass.Tile;
    //markerLayer.MarkerByAxis.Expression = `<[${DIE_X_COL_NAME}] NEST [${DIE_Y_COL_NAME}]>`;

    // for whatever reason, the Projection property doesn't bubble up from
    //  MapChartLayer to MapChartDataLayer/MarkerLayerVisualization, so we have
    //  to get the layer as a regular Layer and set the Projection property there
    const markerLayerAsRegularLayer = mapChart.Layers.Item.get(0)!;
    markerLayerAsRegularLayer.Projection = Projection.None;

    markerLayer.XAxis.Expression = XAXIS_EXPRESSION;
    markerLayer.YAxis.Expression = YAXIS_EXPRESSION;

    // set the color axis and set first Bin color to a light gray
    // (keeping this as a fallback in case the color scheme is unavailable)
    markerLayer.ColorAxis.Expression = COLORAXIS_EXPRESSION;
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
    mapChart.Trellis.PanelAxis.Expression = TRELLIS_PANEL_EXPRESSION;
    mapChart.Trellis.ManualLayout = true;
    mapChart.Trellis.ManualRowCount = TRELLIS_ROWS_COUNT;
    mapChart.Trellis.ManualColumnCount = TRELLIS_COLS_COUNT;

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