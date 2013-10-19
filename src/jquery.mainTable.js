/*
Restrictions:
1. The height and width of scrolable div must be set in pixels (px).
2. If you need to set width of some columns you must do this in the last <tr> of <thead>. Nowhere else in <thead> or <tbody>
*/

/*
version 1.4.25
Plugin is designed by Vitaliy Kryvonos. If you have any questions you may reach me at https://github.com/enterpub/mainTable
*/

// is used for old browsers if Object.create function is not defined
if ( typeof Object.create !== 'function' ) {
    Object.create = function( obj ) {
        function F() {};
        F.prototype = obj;
        return new F();
    };
}

(function ($, window, document, undefined) {

    $("<style type='text/css'> .mt-draghandle.mt-dragging{border-left: 1px solid #333;}</style>").appendTo("head");
    $("<style type='text/css'> .mt-draghandle{ position: absolute; z-index:5; width:5px; cursor:e-resize;}</style>").appendTo("head");

    var helper = {

        isScrollbarElementsCreated: false,

        scrollbarWidth: -100,

        // returns True if a thead and tbody tags exists.
        isTable: function ($obj) {
            var isTable = $obj.is('table'),
                hasHead = $obj.children('thead').length == 1,
                hasBody = $obj.children('tbody').length == 1;

            return isTable && hasHead && hasBody;
        },

        // gets height of 'thead' tag plus width of top border
        getOffsetToHideTableHeader: function ($table) {
            return $table.children('thead:first').outerHeight() + parseInt($table.css('border-top-width'), 10);
        },

        getScrollBarWidth: function () {
            if (!this.isScrollbarElementsCreated) {
                var inner = document.createElement('p');
                inner.style.width = "100%";
                inner.style.height = "200px";

                var outer = document.createElement('div');
                outer.style.position = "absolute";
                outer.style.top = "0px";
                outer.style.left = "0px";
                outer.style.visibility = "hidden";
                outer.style.width = "200px";
                outer.style.height = "150px";
                outer.style.overflow = "hidden";

                outer.appendChild(inner);
                document.body.appendChild(outer);

                var w1 = inner.offsetWidth;
                outer.style.overflow = 'scroll';
                var w2 = inner.offsetWidth;
                if (w1 == w2) w2 = outer.clientWidth;

                this.isScrollbarElementsCreated = true;
                this.scrollbarWidth = w1 - w2;

                document.body.removeChild(outer);
            }

            return this.scrollbarWidth;
        },

        getAllColumnsMinimumWidth: function ($table) {
            var clonedTable = $table.clone();
            var columnWidths = [];

            clonedTable.css('width', '1px').removeAttr('id').css('position', 'absolute').css('left', '-1000px');

            clonedTable.find('> thead > tr > th,> tbody > tr > td').css('width', '1px');

            clonedTable.insertBefore($table);

            clonedTable.find('> thead > tr:last > th').each(function (index) {
                var width = $(this).width();

                columnWidths.push(width);
            });

            clonedTable.remove();

            return columnWidths;
        },

        addNewRowToTableHeaderIfRequired: function($table) {
            var maxColumns = 0;
            var columns;
            $table.find('> thead > tr,> tbody > tr, tfoot > tr').each(function() {
                var currColumns = $(this).children('td,th');
                if (currColumns.length > maxColumns) {
                    maxColumns = currColumns.length;
                    columns = currColumns;
                }
            });

            var lastRowColumns = $table.find('> thead > tr:last > th');
            
            if (lastRowColumns.length != maxColumns) {
                var newRow = '<tr>';

                for (var i = 0; i < maxColumns; i++) {
                    var column = columns.eq(i);
                    newRow += '<th style="height: 0px;padding: 0;border: none;width: ' + columns.eq(i).css('width') + '"></th>';
                };

                newRow += '</tr>';

                $table.children('thead:first').append($(newRow));

                // now I only remove last row; columns width, but better no <td> in header have width specified
                for (var i = 0; i < maxColumns; i++) {
                    lastRowColumns.eq(i).css('width', '');
                };
            }
        }
    };

    var MainTable = {
        init: function( options, elem ) {
            var self = this;

            if ($.isFunction(options.onBegin)) {
                options.onBegin.call(self);
            }

            self.options = $.extend( {}, $.fn.mainTable.options, options );
            self.originalTable = $(elem);

            self.setup();

            if ($.isFunction(self.options.onCreated)) {
                self.options.onCreated.call(self);
            }
        },

        setup: function() {
            this.originalTable.css('width', this.originalTable.css('width'));

            if (this.options.scrollableBodyHeight == -1) {
                if (this.options.scrollableBodyWidth == -1) {
                    this.options.scrollableBodyHeight = this.originalTable.outerHeight() - helper.getOffsetToHideTableHeader(this.originalTable);
                }
                else {
                    this.options.scrollableBodyHeight = this.originalTable.outerHeight() - helper.getOffsetToHideTableHeader(this.originalTable) + helper.getScrollBarWidth();
                }
            }

            if (this.options.scrollableBodyWidth == -1) {
                this.options.scrollableBodyWidth = this.originalTable.outerWidth() + helper.getScrollBarWidth();
            }

            if (this.options.freezeHeader || this.options.allowResizeColumns) {
                /* need add additional row with max quantity of columns in table's header because
                   it may have complex <td>, <tr> structure with rowspans and/or colspans and last <tr> in header may not contain all columns */
                helper.addNewRowToTableHeaderIfRequired(this.originalTable);
            }

            if (this.options.freezeHeader) {
                this.freezeTableHeader();

                if (this.options.quantityOfLeftFixedColumns > 0) {
                    this.freezeTableColumns();
                }

                this.setupSyncronizationWhenScroll();
            }

            if (this.options.allowResizeColumns) {
                this.makeResizable();
            }

            this.setupCollapsibleRows();
        },

        // methods related to fixed columns
        freezeTableColumns: function() {
            var headerDiv = this.headerTable.parents('.mt-header:first');
            var bodyDiv = this.originalTable.parents('.mt-body:first');
            var globalWrapper = this.originalTable.parents('.mt-global-wrapper:first');

            globalWrapper.prepend($('<div class="mt-wrapper" style="float: left;"></div>'));

            var wrapper = globalWrapper.children('.mt-wrapper:first');

            wrapper.prepend(bodyDiv);
            wrapper.prepend(headerDiv);
            
            globalWrapper.prepend($('<div class="mt-wrapper" style="float: left;"></div>'));

            var fixedWrapper = globalWrapper.children('.mt-wrapper:first');
            fixedWrapper.prepend($('<div class="mt-body" style="overflow: hidden;"></div>'));
            fixedWrapper.prepend($('<div class="mt-header"></div>'));

            var fixedHeaderDiv = fixedWrapper.children('.mt-header:first');
            var fixedBodyDiv = fixedWrapper.children('.mt-body:first');

            var clonedHeaderTable = this.cloneLeftFixedHeaderTable();
            var clonedBodyTable = this.createLeftFixedBodyTable();

            fixedHeaderDiv.prepend(clonedHeaderTable);
            fixedBodyDiv.prepend(clonedBodyTable);
            
            fixedBodyDiv.css({
                'height': (this.options.scrollableBodyHeight - helper.getScrollBarWidth()) + 'px'
            });

            var fixedTablesWidth = this.getWidthOfLeftFixedTable();
            
            fixedWrapper.width(fixedTablesWidth);

            this.headerTable.css('margin-left', -fixedTablesWidth + 'px');
            this.originalTable.css('margin-left', -fixedTablesWidth + 'px');

            headerDiv.width(headerDiv.width() - fixedTablesWidth);
            bodyDiv.width(bodyDiv.width() - fixedTablesWidth);

            // this is only to remove left floating after the wrapper div. I.e. make everything fall under the wrapper div
            globalWrapper.append($('<div style="clear: both"></div>'));

            this.leftFixedColumnsBodyTable = clonedBodyTable;
            this.leftFixedColumnsHeaderTable = clonedHeaderTable;
            this.leftFixedHeaderDraggableColumns = clonedHeaderTable.find('> thead > tr:last > th');
            this.leftFixedBodyDraggableColumns = clonedBodyTable.find('> thead > tr:last > th');
        },

        cloneLeftFixedHeaderTable: function() {
            var clonedTable = this.cloneLeftFixedPartOfOriginalTable(this.options.quantityOfLeftFixedColumns);

            clonedTable.children('tbody, tfoot').remove();

            clonedTable.css({
                'border-right': '',
                'border-bottom': '',
                'margin-top': '',
                'width': '100%'
            });

            return clonedTable;
        },

        createLeftFixedBodyTable: function() {
            var clonedTable = this.cloneLeftFixedPartOfOriginalTable(this.options.quantityOfLeftFixedColumns);

            clonedTable.css({
                'border-right': '',
                'width': '100%'
            });

            return clonedTable;
        },

        getWidthOfLeftFixedTable: function() {
            var quantity = this.options.quantityOfLeftFixedColumns;
            var borderSpacing = parseInt(this.originalTable.css('border-spacing'), 10) * (quantity + 1);
            var tableWidth = parseInt(this.originalTable.css('border-left-width'), 10) + borderSpacing;
            
            var columns = this.originalTable.find('> thead > tr:last th');
            for (var i = 0; i < quantity; i++) {
                tableWidth = tableWidth + columns.eq(i).outerWidth();
            };

            return tableWidth;
        },

        cloneLeftFixedPartOfOriginalTable: function(columnsQuantity) {
            var clonedTable = this.originalTable.clone();
            var rows = this.originalTable.find('> thead > tr,> tbody > tr');
            var rowspans = [];

            for (var i = 0; i < columnsQuantity; i++) {
                rowspans.push(1);
            };

            clonedTable.removeAttr('id');
            clonedTable.find('> thead > tr,> tbody > tr').each(function(index) {
                var $this = $(this);

                var columns = $this.children('td,th');
                var columnIndex = -1;

                for (var i = 0; i < columnsQuantity; i++) {
                    var j = i;
                    while (rowspans[j] > 1)
                    {
                        j = j + 1;
                    }

                    i = j;

                    if (i > columnsQuantity - 1) {
                        break;
                    }

                    var colspan = parseInt(columns.eq(i).attr('colspan'), 10);
                    var rowspan = parseInt(columns.eq(i).attr('rowspan'), 10);

                    if (rowspan > 0) {
                        rowspans[i] = rowspan + 1;

                        if (colspan > 0) {

                            for (var k = i + 1; k < colspan + i; k++) {
                                rowspans[k] = rowspan + 1;
                            };
                        }
                    }

                    if (colspan > 0) {
                        i = i + colspan - 1;
                    }

                    columnIndex++;
                };

                for (var i = 0; i < rowspans.length; i++) {
                    if (rowspans[i] > 1) {
                        rowspans[i] = rowspans[i] - 1;
                    }
                };

                if (columnIndex < 0) {
                    columns.remove();
                }
                else {
                    columns.eq(columnIndex).nextAll().remove();
                }

                // explicitly set row height. It is important in case when freezed columns in a row have
                // less height then others in same row
                $this.outerHeight(rows.eq(index).outerHeight());
            });

            return clonedTable;
        },

        syncLeftFixedColumnsSize: function(changeDelta, columnIndex) {
            var currentColumn = this.leftFixedHeaderDraggableColumns.eq(columnIndex);
            var columnNewWidth = (currentColumn.width() + changeDelta) + 'px';

            if (this.options.quantityOfLeftFixedColumns - 1 != columnIndex) {
                    var nextColumn = currentColumn.next();
                    var nextColumnNewWidth = (nextColumn.width() - changeDelta) + 'px';

                    currentColumn.css('width', columnNewWidth);
                    nextColumn.css('width', nextColumnNewWidth);

                    this.leftFixedBodyDraggableColumns.eq(columnIndex).css('width', columnNewWidth);
                    this.leftFixedBodyDraggableColumns.eq(columnIndex + 1).css('width', nextColumnNewWidth);
                }
                else {
                    // the logic for drag handle between last fixed column and first scrollable one
                    var bodyTableCurrentColumn = this.leftFixedBodyDraggableColumns.eq(columnIndex);
                    var fixedWrapper = this.leftFixedColumnsHeaderTable.parents('.mt-wrapper:first');
                    var wrapperNewWidth = fixedWrapper.width() + changeDelta;
                    var leftOffset = this.originalTable.parents('.mt-body:first').scrollLeft();

                    currentColumn.css('width', columnNewWidth);
                    bodyTableCurrentColumn.css('width', columnNewWidth);
                    fixedWrapper.width(wrapperNewWidth);

                    // for header table need alse to count left offset of scrollbar
                    this.headerTable.css('margin-left', -(wrapperNewWidth + leftOffset) + 'px');
                    this.originalTable.css('margin-left', -wrapperNewWidth + 'px');

                    var headerDiv = this.headerTable.parents('.mt-header:first');
                    var bodyDiv = this.originalTable.parents('.mt-body:first');

                    bodyDiv.width(bodyDiv.width() - changeDelta);
                    headerDiv.width(headerDiv.width() - changeDelta);
                }
        },

        syncRowsHeightForFixedTables: function() {
            var originalRows = this.originalTable.find('> thead > tr,> tbody > tr');

            this.leftFixedColumnsHeaderTable.find('> thead > tr').each(function(index) {
                var originalRowHeight = originalRows.eq(index).outerHeight();
                $(this).outerHeight(originalRowHeight);
            });
            
            this.leftFixedColumnsBodyTable.find('> thead > tr,> tbody > tr').each(function(index) {
                var originalRowHeight = originalRows.eq(index).outerHeight();
                $(this).outerHeight(originalRowHeight);
            });

            var topOffset = this.originalTable.parent('.mt-body:first').scrollTop() + helper.getOffsetToHideTableHeader(this.leftFixedColumnsBodyTable);
            this.leftFixedColumnsBodyTable.css({
                'margin-top': -topOffset + 'px'
            });
        },
        // END of methods related to fixed columns

        // methods related to fixed header
        freezeTableHeader: function () {
            var $table = this.originalTable;

            $table.wrap('<div class="mt-global-wrapper"><div class="mt-body" style="overflow-y: scroll;"></div></div>');

            var bodyDiv = $table.parent();

            bodyDiv.css({
                'width': this.options.scrollableBodyWidth + 'px',
                'height': this.options.scrollableBodyHeight + 'px'
            });

            // it is important explicitly set each column width. Because after original table is cloned
            // and prepend into .mt-header container it can be shorter than original table and
            // width of columns may be out of sync. This is very important  in case if original table
            // has any columns with fixed width
            this.explicitlySetColumnsWidth();

            var clonedTable = this.createHeaderTable();

            var wrapper = $table.closest('.mt-global-wrapper');

            var headerDiv = $('<div class="mt-header" style="overflow: hidden;"></div>').wrapInner(clonedTable);
            wrapper.prepend(headerDiv);

            var scrollbarWidth = helper.getScrollBarWidth();
            var headerWidth = this.options.scrollableBodyWidth - scrollbarWidth;
            
            // header width must be less than body width on the width of the scrollbar
            headerDiv.css('width', headerWidth + 'px');
            
            // need to set wrapper width explicitly because if not in case when window is reduced tables markup will brake
            wrapper.width(this.options.scrollableBodyWidth + 'px');

            // hide origin table header under cloned table
            $table.css({
                'margin-top': -helper.getOffsetToHideTableHeader($table)
            });

            this.headerTable = clonedTable;
        },

        // explicitly sets width of each column
        explicitlySetColumnsWidth: function () {
            var columnsWidths = [];
            var columns = this.originalTable.find('> thead > tr:last > th');

            columns.each(function () {
                columnsWidths.push($(this).css('width'));
            });

            columns.each(function(index) {
                var th = $(this);
                th.css('width', columnsWidths[index]);
            });
        },

        createHeaderTable: function () {
            var clonedTable = this.originalTable.clone();

            clonedTable.removeAttr('id')
                .children('tbody').remove()
                .children('tfoot').remove();

            // need to remove formatting of bottom border for cloned table
            clonedTable.css({
                'border-bottom': ''
            });

            return clonedTable;
        },
        // END of methods related to fixed header

        // methods related to resizable columns
        makeResizable: function () {
            var self = this;
            var table;

            if (self.options.freezeHeader) {
                self.draggableColumns = self.headerTable.find('> thead > tr:last th');
                table = self.headerTable;
            }
            else {
                table = self.originalTable;
            }

            self.originalDraggableColumns = self.originalTable.find('> thead > tr:last th');
            self.columnsMinWidth = helper.getAllColumnsMinimumWidth(self.originalTable);

            self.dragHandles = [];
            for (var i = 0; i < self.originalDraggableColumns.length - 1; i++) {

                var dragHandle = $('<div class="mt-draghandle"></div>').insertBefore(table)
                    .data('columnIndex', i)
                    .draggable({
                        axis: "x",
                        scroll: false,
                        start: function () {
                            $(this).addClass("mt-dragging");
                        },
                        stop: function (event, ui) {
                            var $this = $(this);

                            $this.removeClass("mt-dragging");
                            var oldPos = $this.data("uiDraggable").originalPosition.left;
                            var newPos = ui.position.left;

                            self.syncBothColumnsAndSliders(newPos - oldPos, $this.data('columnIndex'));
                        }
                });

                this.dragHandles.push(dragHandle);
            }

            this.syncSlidersPositions();
        },

        correctChangeDelta: function (changeDelta, columnIndex) {
            var draggableColumns = this.originalDraggableColumns;

            if (changeDelta < 0) {
                var columnWidth = draggableColumns.eq(columnIndex).width();
                var minWidth = this.columnsMinWidth[columnIndex];

                if ((columnWidth - Math.abs(changeDelta)) < minWidth) {
                    changeDelta = -(columnWidth - minWidth);
                }
            } else {
                var columnWidth = draggableColumns.eq(columnIndex + 1).width();
                var minWidth = this.columnsMinWidth[columnIndex + 1];

                if ((columnWidth - changeDelta) < minWidth) {
                    changeDelta = columnWidth - minWidth;
                }
            }

            return changeDelta;
        },

        syncBothColumnsAndSliders: function (changeDelta, columnIndex) {
            this.syncColumnsSize(changeDelta, columnIndex);
            this.syncSlidersPositions();

            if (this.options.freezeHeader) {
                this.originalTable.css({
                    'margin-top': -helper.getOffsetToHideTableHeader(this.originalTable)
                });
            }

            // need to sync height of rows for fixed header and body tables
            if (this.options.quantityOfLeftFixedColumns > 0) {
                this.syncRowsHeightForFixedTables();
            }
        },

        syncColumnsSize: function (changeDelta, columnIndex) {
            changeDelta = this.correctChangeDelta(changeDelta, columnIndex);

            if (this.options.freezeHeader) {
                var currentColumn = this.draggableColumns.eq(columnIndex);
                var nextColumn = currentColumn.next();

                var columnNewWidth = (currentColumn.width() + changeDelta) + 'px';
                var nextColumnNewWidth = (nextColumn.width() - changeDelta) + 'px';

                currentColumn.css('width', columnNewWidth);
                nextColumn.css('width', nextColumnNewWidth);

                this.originalDraggableColumns.eq(columnIndex).css('width', columnNewWidth);
                this.originalDraggableColumns.eq(columnIndex + 1).css('width', nextColumnNewWidth);
            }
            else {
                var currentColumn = this.originalDraggableColumns.eq(columnIndex);
                var nextColumn = currentColumn.next();

                var columnNewWidth = (currentColumn.width() + changeDelta) + 'px';
                var nextColumnNewWidth = (nextColumn.width() - changeDelta) + 'px';

                currentColumn.css('width', columnNewWidth);
                nextColumn.css('width', nextColumnNewWidth);
            }

            if (this.options.quantityOfLeftFixedColumns > columnIndex) {
                this.syncLeftFixedColumnsSize(changeDelta, columnIndex);
            }
        },

        // puts all sliders on the correct positions
        syncSlidersPositions: function () {
            var self = this;
            var headerTableHeight = helper.getOffsetToHideTableHeader(self.originalTable);

            self.originalDraggableColumns.not(':last').each(function (index) {
                if (index < self.options.quantityOfLeftFixedColumns) {
                    // ignore draghandles which are attached to the fixed columns header table
                    return;
                }

                var th = $(this);
                var newSliderPosition = th.position().left + th.outerWidth();

                self.dragHandles[index].css({
                    left: newSliderPosition,
                    height: headerTableHeight + 'px'
                });
            });

            // sync drag handles for fixed columns header table
            if (this.options.quantityOfLeftFixedColumns > 0) {
                self.leftFixedBodyDraggableColumns.each(function (index) {
                    var th = $(this);
                    var newSliderPosition = th.position().left + th.outerWidth();

                    self.dragHandles[index].css({
                        left: newSliderPosition,
                        height: headerTableHeight + 'px'
                    });
                });
            }

            var globalWrapperWidth = this.originalTable.parents('.mt-global-wrapper:first').width();

            // need to make 'display: none' for those drag handles which are out of global wrapper,
            // because if not to do it and if left position of drag handle is bigger than window.width() then
            // it stratches the window in width and bottom scroll bar appears on the window
            for (var i = 0; i < this.dragHandles.length; i++) {
                var leftPosition = parseInt(this.dragHandles[i].css('left'), 10);

                if (leftPosition > globalWrapperWidth) {
                    this.dragHandles[i].hide();
                } else {
                    this.dragHandles[i].show();
                }
            };
        },
        // END of methods related to resizable columns

        setupSyncronizationWhenScroll: function() {
            var self = this;

            self.originalTable.parent('.mt-body:first').on('scroll', function(){
                var $this = $(this);

                var leftOffset = $this.scrollLeft() - parseInt(self.originalTable.css('margin-left'), 10);
                
                self.headerTable.css('margin-left', -leftOffset + 'px');

                if (self.options.quantityOfLeftFixedColumns > 0) {
                    var topOffset = $this.scrollTop() + helper.getOffsetToHideTableHeader(self.originalTable);
                    self.leftFixedColumnsBodyTable.css('margin-top', -topOffset + 'px');
                }

                if (self.options.allowResizeColumns) {
                    self.syncSlidersPositions();
                }
            });

            if (self.options.quantityOfLeftFixedColumns > 0) {
                self.leftFixedColumnsBodyTable.parent('.mt-body:first').bind('mousewheel', function(e) {
                    e.preventDefault();

                    var div = self.originalTable.parent('.mt-body:first');

                    if (e.originalEvent.wheelDelta / 120 > 0) {
                        div.scrollTop(div.scrollTop() - 100);
                    } else {
                        div.scrollTop(div.scrollTop() + 100);
                    }

                    div.trigger('scroll');
                });
            }
        },
        
        // methods for collapsible rows
        setupCollapsibleRows: function() {
            var self = this;

            var originalRows = self.originalTable.find('> tbody > tr');
            var leftFixedTableRows;

            if (self.options.quantityOfLeftFixedColumns > 0) {
                leftFixedTableRows = self.leftFixedColumnsBodyTable.find('> tbody > tr');
            }

            self.collapseRowsWhenInitialized(originalRows, leftFixedTableRows);

            originalRows.filter('[data-mt-collapsible]').on('click', function (e) {
                e.stopPropagation();
                var tr = $(this);
                var rowIndex = originalRows.index(this);
                
                if (tr.attr('data-mt-collapsible') != '1') {
                    return;
                }

                var skipRowsQuantity = 0;
                if (typeof tr.attr('data-mt-collapsible-rows-skip') != 'undefined') {
                    skipRowsQuantity = parseInt(tr.attr('data-mt-collapsible-rows-skip'), 10);
                };

                var firstRowToProcess = tr.next();
                for (var i = 0; i < skipRowsQuantity; i++) {
                    firstRowToProcess = firstRowToProcess.next();
                };

                var otherRow;
                if (firstRowToProcess.css('display') == 'none') {
                    self.expandRows(tr, originalRows);

                    if (self.options.quantityOfLeftFixedColumns > 0) {
                        otherRow = leftFixedTableRows.eq(rowIndex);
                        self.expandRows(otherRow, leftFixedTableRows);

                        // when row is display==none its outerHeight is calculated wrong. That is why need to sync height of rows when they
                        // become shown
                        self.syncRowsHeightForFixedTables();
                    }

                    self.triggerRowExpandOrCollapseEvent(self.options.onRowsExpanded, tr, otherRow, 'original');
                }
                else {
                    self.collapseRows(tr, originalRows);

                    if (self.options.quantityOfLeftFixedColumns > 0) {
                        otherRow = leftFixedTableRows.eq(rowIndex);
                        self.collapseRows(otherRow, leftFixedTableRows);
                    }

                    self.triggerRowExpandOrCollapseEvent(self.options.onRowsCollapsed, tr, otherRow, 'original');
                }
            });

            if (self.options.quantityOfLeftFixedColumns > 0) {
                leftFixedTableRows.filter('[data-mt-collapsible]').on('click', function (e) {
                    e.stopPropagation();
                    var tr = $(this);
                    var rowIndex = leftFixedTableRows.index(this);

                    if (tr.attr('data-mt-collapsible') != '1') {
                        return;
                    }

                    var skipRowsQuantity = 0;
                    if (typeof tr.attr('data-mt-collapsible-rows-skip') != 'undefined') {
                        skipRowsQuantity = parseInt(tr.attr('data-mt-collapsible-rows-skip'), 10);
                    };

                    var firstRowToProcess = tr.next();
                    for (var i = 0; i < skipRowsQuantity; i++) {
                        firstRowToProcess = firstRowToProcess.next();
                    };

                    var otherRow = originalRows.eq(rowIndex);
                    if (firstRowToProcess.css('display') == 'none') {
                        self.expandRows(tr, leftFixedTableRows);
                        self.expandRows(otherRow, originalRows);

                        self.triggerRowExpandOrCollapseEvent(self.options.onRowsExpanded, otherRow, tr, 'leftFixed');

                        // when row is display==none its outerHeight is calculated wrong. That is why need to sync height of rows when they
                        // become shown
                        self.syncRowsHeightForFixedTables();
                    }
                    else {
                        self.collapseRows(tr, leftFixedTableRows);
                        self.collapseRows(otherRow, originalRows);

                        self.triggerRowExpandOrCollapseEvent(self.options.onRowsCollapsed, otherRow, tr, 'leftFixed');
                    }
                });
            }
        },

        collapseRows: function($row, $allRows) {
            var tr = $row;

            var rowsQuantity = parseInt(tr.attr('data-mt-collapsible-rows'), 10);
            var prevQuantity = tr.prevAll().length;
            var skipRowsQuantity = 0;

            if (typeof tr.attr('data-mt-collapsible-rows-skip') != 'undefined') {
                skipRowsQuantity = parseInt(tr.attr('data-mt-collapsible-rows-skip'), 10);
            };

            var rows = $allRows.slice(prevQuantity + skipRowsQuantity + 1, prevQuantity + skipRowsQuantity + 1 + rowsQuantity);

            rows.hide();
            this.changeCollapsedStateOfRowsWithSameGroupInternal($row, '1');
        },

        expandRows: function($row, $allRows) {
            var rowsQuantity = parseInt($row.attr('data-mt-collapsible-rows'), 10);
            var prevQuantity = $row.prevAll().length;
            var skipRowsQuantity = 0;

            if (typeof $row.attr('data-mt-collapsible-rows-skip') != 'undefined') {
                skipRowsQuantity = parseInt($row.attr('data-mt-collapsible-rows-skip'), 10);
            };

            var rows = $allRows.slice(prevQuantity + skipRowsQuantity + 1, prevQuantity + skipRowsQuantity + 1 + rowsQuantity);

            this.expandRowsInternal(rows);
            this.changeCollapsedStateOfRowsWithSameGroupInternal($row, '0');
        },

        /* change state for all previous and next rows in group */
        changeCollapsedStateOfRowsWithSameGroupInternal: function($row, state) {
            var skipRowsQuantity = 0;
            if (typeof $row.attr('data-mt-collapsible-rows-skip') != 'undefined') {
                skipRowsQuantity = parseInt($row.attr('data-mt-collapsible-rows-skip'), 10);
            };

            $row.attr('data-mt-collapsed', state);
            
            // previous rows
            var prevRow = $row.prev();
            while (parseInt(prevRow.attr('data-mt-collapsible-rows-skip'), 10) > 0)
            {
                prevRow.attr('data-mt-collapsed', state);
                prevRow = prevRow.prev();
            }

            // next rows
            if (skipRowsQuantity > 0) {
                var nextRow = $row.next();
                while (parseInt(nextRow.attr('data-mt-collapsible-rows-skip'), 10) > 0)
                {
                    nextRow.attr('data-mt-collapsed', state);
                    nextRow = nextRow.next();
                }

                nextRow.attr('data-mt-collapsed', state);
            }
        },

        expandRowsInternal: function($rows) {
            for (var i = 0; i < $rows.length; i++) {
                var row = $rows.eq(i);

                if (typeof row.attr('data-mt-collapsed') != 'undefined'
                    && row.attr('data-mt-collapsed') == '1') {

                    var collRows = parseInt(row.attr('data-mt-collapsible-rows'), 10);
                    var collSkipRows = typeof row.attr('data-mt-collapsible-rows-skip') != 'undefined' 
                                                ? parseInt(row.attr('data-mt-collapsible-rows-skip'), 10)
                                                : 0;

                    // showing all skipped rows too
                    for (var j = 0; j < collSkipRows; j++) {
                        var skippedRow = $rows.eq(i + j + 1);

                        //skippedRow.attr('data-mt-collapsed', '0');
                        skippedRow.show();
                    };

                    // and leave collapsed all others after skipped ones
                    i += collRows + collSkipRows;
                }

                row.show();
            }
        },

        triggerRowExpandOrCollapseEvent: function(func, originalRow, leftFixedRow, rowClicked) {
            var self = this;

            if ($.isFunction(func)) {
                func.call(
                    self,
                    {
                        rowClicked: rowClicked,
                        rows: {
                            original: originalRow,
                            leftFixed: leftFixedRow
                        }
                    });
            }
        },

        collapseRowsWhenInitialized: function($allOriginalRows, $allLeftFixedRows) {
            var self = this;

            // TODO: here need to trigger event too

            $allOriginalRows.filter('[data-mt-collapsible="1"]').each(function() {
                var tr = $(this);

                if (tr.attr('data-mt-collapsed') == '1') {
                    self.collapseRows(tr, $allOriginalRows);

                    var otherRow;
                    if (self.options.quantityOfLeftFixedColumns > 0) {
                        var rowIndex = $allOriginalRows.index(this);
                        otherRow = $allLeftFixedRows.eq(rowIndex);

                        self.collapseRows(otherRow, $allLeftFixedRows);
                    }

                    self.triggerRowExpandOrCollapseEvent(self.options.onRowsCollapsed, tr, otherRow, 'original');
                }
            });
        }

        // END of methods for collapsible rows
    };

    $.fn.mainTable = function (options) {
        var tables = this.filter(function() {
            return helper.isTable($(this));
        });

        if (typeof options == 'string') {
            tables.each(function() {
                var table = $(this);
                var plugin = table.data('mainTable');

                if (typeof plugin != 'undefined') {
                    var originalRows = plugin.originalTable.find('> tbody > tr');
                    var leftFixedTableRows;

                    if (plugin.options.quantityOfLeftFixedColumns > 0) {
                        leftFixedTableRows = plugin.leftFixedColumnsBodyTable.find('> tbody > tr');
                    }

                    if (options == 'collapseAll') {
                        originalRows.filter('[data-mt-collapsible="1"]').each(function () {
                            var originalRow = $(this);

                            plugin.collapseRows(originalRow, originalRows);

                            var otherRow;
                            if (plugin.options.quantityOfLeftFixedColumns > 0) {
                                var rowIndex = originalRows.index(this);
                                otherRow = leftFixedTableRows.eq(rowIndex);

                                plugin.collapseRows(otherRow, leftFixedTableRows);
                            }

                            plugin.triggerRowExpandOrCollapseEvent(plugin.options.onRowsCollapsed, originalRow, otherRow, 'original');
                        });
                    }
                    else if (options == 'expandAll') {
                        originalRows.each(function () {
                            var originalRow = $(this);

                            if (originalRow.attr('data-mt-collapsible') == '1' && originalRow.attr('data-mt-collapsed') == '1') {
                                plugin.changeCollapsedStateOfRowsWithSameGroupInternal(originalRow, '0');
                            }

                            var otherRow;
                            if (plugin.options.quantityOfLeftFixedColumns > 0) {
                                var rowIndex = originalRows.index(this);
                                otherRow = leftFixedTableRows.eq(rowIndex);

                                if (otherRow.attr('data-mt-collapsible') == '1' && otherRow.attr('data-mt-collapsed') == '1') {
                                    plugin.changeCollapsedStateOfRowsWithSameGroupInternal(otherRow, '0');
                                }

                                otherRow.show();
                            }

                            originalRow.show();

                            plugin.triggerRowExpandOrCollapseEvent(plugin.options.onRowsExpanded, originalRow, otherRow, 'original');
                        });

                        if (plugin.options.quantityOfLeftFixedColumns > 0) {
                            // when row is display==none its outerHeight is calculated wrong. That is why need to sync height of rows when they
                            // become shown
                            plugin.syncRowsHeightForFixedTables();
                        }
                    }
                }
            });
        }
        else {
            return tables.each(function() {

                var mainTable = Object.create( MainTable );
                
                mainTable.init( options, this );

                $.data( this, 'mainTable', mainTable );
            });
        }
    };

    $.fn.mainTable.options = {
        allowResizeColumns: true,
        freezeHeader: false,
        scrollableBodyHeight: -1,
        scrollableBodyWidth: -1,
        quantityOfLeftFixedColumns: 0,
        onRowsExpanded: null,
        onRowsCollapsed: null,
        onBegin: null,
        onCreated: null
    };

}(jQuery, window, document));