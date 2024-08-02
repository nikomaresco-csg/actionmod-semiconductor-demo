

/*
* attempts to verify that the Spotfire Analyst client is connected to a Spotfire Server
*
* @param application - the current application context
* @returns true if the client is connected to a server, false otherwise
*/
export function checkServerConnection(
    application: Spotfire.Dxp.Application.AnalysisApplication
): boolean {
    const connectivityService = application.GetService(
        Spotfire.Dxp.Framework.ApplicationModel.ConnectivityService
    );
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
export function getLibraryItem(
    lm: Spotfire.Dxp.Framework.Library.LibraryManager,
    itemPath: string,
    itemType: Spotfire.Dxp.Framework.Library.LibraryItemType
): Spotfire.Dxp.Framework.Library.LibraryItem {
    const item = OutParam.create(Spotfire.Dxp.Framework.Library.LibraryItem);
    if (!lm.TryGetItem(itemPath, itemType, item.out)) {
        throw new Error(`Library item not found: ${itemPath}`);
    }
    return item;
}

/*
* attempts to get a ColorScheme from the Spotfire Library with the given path
*
* @param application - the current application context
* @param libraryPath - the path to the ColorScheme in the Library
* @returns the ColorScheme with the given path
*/
export function getColorSchemeFromLibrary(
    application: Spotfire.Dxp.Application.AnalysisApplication,
    libraryPath: string
): Spotfire.Dxp.Framework.Library.LibraryItem {
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

/*
* attempts to get a ColorScheme from the current document with the given name
*
* @param document - the current Document context
* @param colorSchemeName - the name of the ColorScheme to get
* @returns the ColorScheme with the given name
*/
export function getColorSchemeFromDocument(
    document: Spotfire.Dxp.Application.Document,
    colorSchemeName: string
): Spotfire.Dxp.Application.Visuals.ConditionalColoring.Coloring {
    return document.ColoringTemplates.Item.get(colorSchemeName)!;
}

/*
* searches the library with a given query string and returns the results
* 
* @param application - the current application context
* @param searchExpression - the query string to search the library with
* @returns a collection of LibraryItems that match the search query
*/
export function searchLibrary(
    application: Spotfire.Dxp.Application.AnalysisApplication,
    searchExpression: string
): Spotfire.Dxp.Framework.Library.LibraryItemCollection {
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