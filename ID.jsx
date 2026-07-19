//DESCRIPTION: Adobe InDesign Script for developers to show ID of layer, page, and page item
/*
Author:- Manan Joshi
Date:- 19/07/2026
*/

#targetengine "layer-page-ui"

var palette = new Window("palette", "Layer & Page Items");
palette.alignChildren = "fill";


// =============================
// Layers List
// =============================
palette.add("statictext", undefined, "Layers:");
var layerListBox = palette.add("listbox", undefined, [], { multiselect: true });
layerListBox.preferredSize = [250, 100];


// =============================
// Page Dropdown
// =============================
var pageGroup = palette.add("group");
pageGroup.orientation = "row";
pageGroup.add("statictext", undefined, "Page:");
var pageDropdown = pageGroup.add("dropdownlist", undefined, []);
pageDropdown.preferredSize.width = 250;


// =============================
// Page Items List
// =============================
palette.add("statictext", undefined, "Page Items:");
var pageItemsListBox = palette.add("listbox", undefined, [], { multiselect: false });
pageItemsListBox.preferredSize.height = 120;


// =============================
// Selection Info
// =============================
var infoGroup = palette.add("group");
infoGroup.orientation = "row";
infoGroup.add("statictext", undefined, "Selected:");
var selectionLabel = infoGroup.add("statictext", undefined, "None");
selectionLabel.preferredSize.width = 250;


// =============================
// Search by ID
// =============================
var searchGroup = palette.add("group");
searchGroup.orientation = "row";
searchGroup.add("statictext", undefined, "Find ID:");

var searchInput = searchGroup.add("edittext", undefined, "");
searchInput.characters = 10;

var findBtn = searchGroup.add("button", undefined, "Find");


// =====================================================
// Helper Functions
// =====================================================

var uiUpdating = false;
var lastUIState = "";

// One DOM round-trip instead of one per index access
function collectionToArray(coll) {
    return coll.length ? coll.everyItem().getElements() : [];
}

function pageItemLabel(obj) {
    return obj.constructor.name + " (ID:" + obj.id + ")";
}

function makeIdIndex(refKey) {
    var byId = {};

    function getList() {
        if (refKey === "layerRef") return layerListBox;
        if (refKey === "pageRef") return pageDropdown;
        return pageItemsListBox;
    }

    function getItems() {
        if (!app.documents.length) return [];

        if (refKey === "layerRef") return collectionToArray(app.documents[0].layers);
        if (refKey === "pageRef") return collectionToArray(app.documents[0].pages);

        if (refKey === "pageItemRef") {
            if (!pageDropdown.selection) return [];

            var selectedLayers = getSelectedLayers();
            var showAll = selectedLayers.length === 0;
            var layerNames = {};
            for (var j = 0; j < selectedLayers.length; j++)
                layerNames[selectedLayers[j]] = true;

            var items = collectionToArray(pageDropdown.selection.pageRef.pageItems);
            var out = [];

            for (var i = 0; i < items.length; i++) {
                var pi = items[i];
                if (!pi.isValid) continue;

                if (showAll || layerNames[pi.itemLayer.name] === true)
                    out.push(pi);
            }
            return out;
        }

        return [];
    }

    function getLabel(obj) {
        if (refKey === "pageItemRef") return pageItemLabel(obj);
        return obj.name + " (ID:" + obj.id + ")";
    }

    return {
        clear: function () {
            byId = {};
            getList().removeAll();
        },
        get: function (id) {
            var key = String(id);
            return byId[key] !== undefined ? byId[key] : null;
        },
        select: function (id) {
            var uiItem = this.get(id);
            if (!uiItem) return;

            var wasUpdating = uiUpdating;
            uiUpdating = true;
            try {
                getList().selection = uiItem;
            } finally {
                uiUpdating = wasUpdating;
            }
        },
        rebuild: function () {
            byId = {};
            var list = getList();
            list.removeAll();

            var items = getItems();
            for (var i = 0; i < items.length; i++) {
                var obj = items[i];
                if (!obj) continue;

                var uiItem = list.add("item", getLabel(obj));
                uiItem[refKey] = obj;
                byId[String(obj.id)] = uiItem;
            }
        }
    };
}

var layerIndex = makeIdIndex("layerRef");
var pageIndex = makeIdIndex("pageRef");
var pageItemIndex = makeIdIndex("pageItemRef");

function getSelectedPageItem() {
    if (app.documents.length && app.selection.length === 1) {
        var el = app.selection[0].getElements()[0];
        return el && el.isValid ? el : null;
    }
    return null;
}

function getUIStateKey() {
    if (!app.documents.length) return "empty";
    try {
        var doc = app.documents[0];
        var sel = getSelectedPageItem();
        var pageId = app.layoutWindows.length ? app.layoutWindows[0].activePage.id : "";
        return doc.id + "|" + pageId + "|" + doc.activeLayer.id + "|" + (sel ? sel.id : "");
    } catch (e) {
        return "error";
    }
}

function clearPanel() {
    var wasUpdating = uiUpdating;
    uiUpdating = true;
    try {
        layerIndex.clear();
        pageIndex.clear();
        pageItemIndex.clear();
        selectionLabel.text = "None";
        searchInput.text = "";
    } finally {
        uiUpdating = wasUpdating;
    }
    lastUIState = "empty";
}

function selectPageItem(pageItem) {
    if (!pageItem || !pageItem.isValid) return false;

    var layer = pageItem.itemLayer;
    if (layer) {
        if (!layer.visible) {
            alert("Cannot select: layer \"" + layer.name + "\" is invisible.");
            return false;
        }
        if (layer.locked) {
            alert("Cannot select: layer \"" + layer.name + "\" is locked.");
            return false;
        }
    }

    if (!pageItem.visible) {
        alert("Cannot select: object is invisible.");
        return false;
    }
    if (pageItem.locked) {
        alert("Cannot select: object is locked.");
        return false;
    }

    try {
        app.select(pageItem);
        return true;
    } catch (e) {
        alert("Selection failed: " + e);
        return false;
    }
}

function getSelectedLayers() {
    var selectedLayers = [];
    if (!layerListBox.selection) return selectedLayers;

    for (var i = 0; i < layerListBox.selection.length; i++)
        selectedLayers.push(layerListBox.selection[i].layerRef.name);

    return selectedLayers;
}

function populatePageItems() {
    pageItemIndex.rebuild();

    var selected = getSelectedPageItem();
    if (selected) pageItemIndex.select(selected.id);
}

function refreshUI(force) {
    if (uiUpdating) return;

    uiUpdating = true;
    try {
        if (app.documents.length === 0) {
            clearPanel();
            return;
        }

        var stateKey = getUIStateKey();
        if (!force && stateKey === lastUIState) return;

        searchInput.text = "";

        var doc = app.documents[0];
        var selected = getSelectedPageItem();

        layerIndex.rebuild();
        layerIndex.select(doc.activeLayer.id);

        pageIndex.rebuild();
        if (app.layoutWindows.length)
            pageIndex.select(app.layoutWindows[0].activePage.id);

        populatePageItems();

        selectionLabel.text = selected ? pageItemLabel(selected) : "None";

        lastUIState = stateKey;
    } catch (e) {
        $.writeln("refreshUI error: " + e);
    } finally {
        uiUpdating = false;
    }
}

function findPageItemByID(id) {
    if (!app.documents.length) return;

    var pageItem = null;
    try{
        pageItem = app.documents[0].pageItems.itemByID(Number(id));
        pageItem.itemLayer;
    }
    catch(e) {
        alert("No page item found with ID: " + id);
        return;
    }

    if (!selectPageItem(pageItem)) return;

    // afterSelectionChanged already rebuilt panel; sync filters to found item
    uiUpdating = true;
    try {
        layerListBox.selection = null;
        layerIndex.select(pageItem.itemLayer.id);

        var parentPage = pageItem.parentPage;
        if (!parentPage) return;

        pageIndex.select(parentPage.id);
        populatePageItems();
        pageItemIndex.select(pageItem.id);

        selectionLabel.text = pageItemLabel(pageItem);
        lastUIState = getUIStateKey();
    } finally {
        uiUpdating = false;
    }
}


// =====================================================
// Event Handlers
// =====================================================

pageItemsListBox.onChange = function () {
    if (uiUpdating) return;
    var sel = this.selection;
    if (!sel || !sel.pageItemRef || !sel.pageItemRef.isValid) return;

    if (!selectPageItem(sel.pageItemRef)) return;
    selectionLabel.text = pageItemLabel(sel.pageItemRef);
};

layerListBox.onChange = function () {
    if (uiUpdating) return;
    populatePageItems();
};

pageDropdown.onChange = function () {
    if (uiUpdating) return;
    populatePageItems();
};

findBtn.onClick = function () {
    if (!searchInput.text.match(/^\d+$/)) {
        alert("Please enter a valid numeric PageItem ID.");
        return;
    }
    findPageItemByID(searchInput.text);
};

searchInput.addEventListener("keydown", function (k) {
    if (k.keyName === "Enter") {
        findBtn.notify();
    }
});

palette.onShow = function () {
    refreshUI(true);
    searchInput.active = true;
};

function ensureListener(name, eventType, handler) {
    if (app.eventListeners.itemByName(name).isValid) return;
    app.addEventListener(eventType, handler).name = name;
}

ensureListener("com.mj.selChanged", "afterSelectionChanged", function () {
    refreshUI(false);
});

ensureListener("com.mj.docActivate", "afterActivate", function () {
    refreshUI(false);
});

ensureListener("com.mj.docClose", "afterClose", function () {
    if (app.documents.length === 0) clearPanel();
});


palette.show();