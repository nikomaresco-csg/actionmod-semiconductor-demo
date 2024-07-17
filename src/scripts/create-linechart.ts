import { getColorSchemeFromDocument, getColorSchemeFromLibrary } from "../utils/library";
import { getOrCreateMarking } from "../utils/data";

const { LineChart,  LabelOrientation } = Spotfire.Dxp.Application.Visuals;
const { LibraryManager, LibraryItemType } = Spotfire.Dxp.Framework.Library;


const MARKING_NAME = "Marking";
const CHART_TITLE = "Zone Profiles";
const XAXIS_EXPRESSION = "<[Axis.Default.Names]>";
const XAXIS_SCALE_ORIENTATION = LabelOrientation.Vertical;
const YAXIS_EXPRESSION = "[CirclePct.Center], [CirclePct.Donut], [CirclePct.Edge], [SegmentPct.1],[SegmentPct.2],[SegmentPct.3],[SegmentPct.4],[SegmentPct.5],[SegmentPct.6], [MaskPct.1],  [MaskPct.2], [MaskPct.3], [MaskPct.4], [MaskPct.5], [MaskPct.6], [MaskPct.7], [MaskPct.8], [MaskPct.9]";
const LINEBYAXIS_EXPRESSION = "<[New Wafer]>";
const COLORAXIS_EXPRESSION = "<Bin>";
const WHERECLAUSE_EXPRESSION = "[Bin] >=2";
const COLORSCHEME_LIBRARY_PATH = "/Big Wafer";


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
    lineChart.Data.MarkingReference = getOrCreateMarking(document, "Marking");
    
    try {
        const documentColorScheme = getColorSchemeFromDocument(document, "Big Wafer");
        lineChart.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);

    } catch (noDocumentColorSchemeError) {
        // scheme not found in the document; look in the library instead
        try {
            const libraryColorScheme = getColorSchemeFromLibrary(application, COLORSCHEME_LIBRARY_PATH);
            const documentColorScheme = document.ColoringTemplates.AddFromLibrary(libraryColorScheme);
            lineChart.ColorAxis.Coloring.Apply(documentColorScheme.DisplayName);
        } catch (libraryAccessError) {
            // probably the user is not connected to a server, or the library path is invalid
            // do nothing, the user will have to set the color scheme manually
        }
    }

}

RegisterEntryPoint(createLinechart);
