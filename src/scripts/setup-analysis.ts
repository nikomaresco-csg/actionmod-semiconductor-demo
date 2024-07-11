// const { DataProperty, DataType, DataPropertyClass } = Spotfire.Dxp.Data;
// const { VisualTypeIdentifiers } = Spotfire.Dxp.Application.Visuals;
// const { MapChart, Projection } = Spotfire.Dxp.Application.Visuals.Maps;

// export function setup_analysis({ document, application }: SetupAnalysisParameters) {

//     let page = document.ActivePageReference;
//     if (!page)
//         page = document.Pages.AddNew();
    
//     const wafer_plot = page.Visuals.AddNew(VisualTypeIdentifiers.MapChart2).As(MapChart);
//     if (!wafer_plot)
//         return;
//     wafer_plot.Title = "semiconductor test";
    
//     wafer_plot.Layers.Clear();
//     wafer_plot.Projection = Projection.None;
//     wafer_plot.AutoZoom = false;
//     wafer_plot.ShowNavigationControls = false;
//     wafer_plot.ShowScale = false;
//     wafer_plot.ShowSearchField = false;

    
// }

// RegisterEntryPoint(setup_analysis);
