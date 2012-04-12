/*
 * Copyright 2010 - 2012 Ed Venaglia
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * <h3>Overview</h3>
 * Data tables are containers that manage a collection of similar objects. The
 * power of a data table lies in its ability to maintain indexes on those
 * objects so query criteria may be applied optimally.
 * <p>
 * In general, data tables can yield up to (c+1)*log(n) performance on queries
 * where c is the number of matching rows. When queries with criteria that is
 * not indexed, c*n performance can result.
 * <p>
 * <strong>This utility requires prototype v1.6.</strong>
 * <a href="http://www.prototypejs.org/">What's this?</a>
 *
 * <h3>Data rows</h3>
 * Data objects that are in the data table will always contain a $ property.
 * This $ property is a function that, when called with no arguments, will
 * return the data row as it exists in the table. This can be used to check
 * for changed data fields. The returned row always represents the most current
 * value in the table.
 * <p>
 * Row objects may always be manipulated safely. Data and indexes in the table
 * are only updated when a row object is passed to DataTable.update(). This
 * includes the row object returned by calling row.$().
 * <p>
 * If a row needs to be duplicated, delete the $ property before attempting to
 * insert it back into the table:
 * <code>
 *     function duplicateRow(row, table) {
 *         delete row.$;
 *         return table.insert(row)[0];
 *     }
 * </code>
 *
 * <h3>Optimizing and Troubleshooting</h3>
 * DataTable.verbose(true) will log all insert, update, remove, and findWhere
 * operations to the browser's console. Only set this in development when
 * optimizing indexes or troubleshooting.
 * <p>
 * DataTable.paranoia(true) will validate all indexes every time data is
 * changed. This is particularly expensive, but can help you determine if a bug
 * is in external code or within this mechanism.
 * <p>
 * DataTable.index(["col1","col2"...]).toHtml() will return a jQuery object
 * that may be added to your web page to present detail an index in a way that
 * a human might actually understand.
 * <p>
 * <strong>The toHtml() utility requires jQuery v1.3 or later.</strong> Please
 * read the
 * <a href="http://docs.jquery.com/Using_jQuery_with_Other_Libraries">jQuery
 * documentation</a> regarding the necessary workaround for using jQuery and
 * prototype simultaneously.
 */
var DataTable = null;
(function() { // scoping function isolate local utility functions

/**
 * Values that may be passed to row.$().
 */
var ROW_META_DATA = {
	INDEX: {},
	ORIGINAL: {},
	TABLE_ID: {}
};

/**
 * Utility to append one array onto another. We cannot always use concat()
 * because it creates a new array, in this case we need to modify the array in
 * place.
 * <p>
 * Some native methods in IE do not permit the use of .apply(), so an
 * alternative function may be used that is still more efficient that calling
 * push() a bunch of times.
 */
var append = typeof ([].splice.apply) == "function"
    ? function (array, newArray) {
        array.splice.apply(array, [array.length,0].concat(newArray));
    }
    : function(array, newArray) {
        var count = newArray.length, ix = array.length;
        array.length = ix + count;
        for (var i = 0; i < count; i++, ix++) array[ix] = newArray[i];
    };

var extend = function(obj, from) {
    if (from === ary) {
        for (var j in from) {
            if (from.hasOwnProperty(j) && typeof obj[j] === "undefined") {
                obj[j] = from[j];
            }
        }
    } else {
        for (var k in from) {
            if (from.hasOwnProperty(k)) obj[k] = from[k];
        }
    }
    return obj;
};

var bind = function(f, ctx) {
    if (ctx == null) return f;
    return function() { f.apply(ctx, arguments); };
};

// Used by ary.each() to detect when loops are explicitly aborted
var _$break = {};

// Functional methods for iteration and lambda operations
var ary = {
    each: function(f, ctx) {
        f = bind(f, ctx);
        try {
            for (var i = 0, j = this.length; i < j; ++i) f(this[i], i);
        } catch (e) {
            if (e != _$break) throw e;
        }
        return this;
    },
    collect: function(f, ctx) {
        f = bind(f, ctx);
        var a = newArray();
        ary.each.call(this, function(v, i) { a[i] = f(v); });
        return a;
    },
    inject: function(a, f, ctx) {
        f = bind(f, ctx);
        ary.each.call(this, function(v) { a = f(a, v); });
        return a;
    },
    find: function(f, ctx) {
        f = f ? bind(f, ctx) : function(_) { return _; };
        var result;
        ary.each.call(this, function(obj) { if (f(obj)) { result = obj; throw _$break; }});
        return result;
    },
    findAll: function(f, ctx) {
        f = f ? bind(f, ctx) : function(_) { return _; };
        var a = newArray();
        ary.each.call(this, function(v) { if (f(v)) a.push(v); });
        return a;
    },
    last: function() {
        return this.length ? this[this.length - 1] : void(0);
    },
    pluck: function(k) {
        var a = newArray();
        ary.each.call(this, function(v) { a.push(v && v[k]); });
        return a;
    },
    include: function(o) {
        if (typeof this.indexOf == "function") return this.indexOf(o) != -1;
        var result = false;
        ary.each.call(this, function(obj) { if (result == obj) { result = true; throw _$break; }});
        return result;
    },
    uniq: function() {
        return ary.inject.call(this, newArray(), function(array, value, index) {
            if (0 == index || !array.include(value)) array.push(value);
            return array;
        });
    },
    without: function() {
        var wout = newArray.apply(null, arguments);
        return ary.inject.call(this, newArray(), function(a, v) {
            if (wout.indexOf(v) == -1) a.push(v);
            return a;
        });
    },
    toJSON: function() {
        var results = newArray();
        ary.each.call(this, function(object) {
            var value = toJSON(object);
            if (typeof value != "undefined") results.push(value);
        });
        return '[' + results.join(', ') + ']';
    }
};

/**
 * Utility to build a JavaScript Array with helper functions attached to it.
 */
var newArray = function() {
    var a = new Array(arguments.length);
    for (var i = 0, j = arguments.length; i < j; ++i) a[i] = arguments[i];
    return extend(a, ary);
};

/**
 * utility function to convert an object into a JSON string literal, typically
 * used to perform deep clones of data.
 * @param object the object to convert into a JSON string literal.
 */
var toJSON = function(object) {
    switch (typeof object) {
        case "undefined":
        case "function":
        case "unknown": return void(0);
        case "boolean": return object.toString();
    }

    if (object === null) return "null";
    if (object.constructor == String) {
        var esc = {"\"": "\\\"", "\b": "\\b", "\f": "\\f", "\n": "\\n",
                   "\r": "\\r", "\t": "\\t", "\\": "\\\\"};
        return "\"" + object.replace(/[\x00-\x1f\\"]/g, function(match) {
            return esc[match[0]] ||
                    "\\u00" + (match[0].charCodeAt(0) < 16 ? "0" : "") +
                               match[0].charCodeAt(0).toString(16);
        }) + "\"";
    }
    if (object.constructor == Number) {
        return isFinite(object) ? object.toString() : "null";
    }
    if (typeof object.toJSON == "function") return object.toJSON();

    var results = [];
    for (var property in object) {
        if (object.hasOwnProperty(property)) {
            var value = toJSON(object[property]);
            if (value !== undefined)
                results.push(toJSON(String(property)) + ": " + value);
        }
    }

    return "{" + results.join(", ") + "}";
};

/**
 * Stupid loop to estimate log[base2] cost for a given size
 * @param size
 */
var simpleLog2Cost = function (size) {
    var log = 0;
    while (size > 0) { size >>= 1; log++; }
    return log;
};

var tablesIdentities = {};

/**
 * Utility that ensures that a table is the same table as expected.
 * @param expectedTable
 * @param checkTableIdentity
 */
var checkTableIdentity = function(expectedTable, checkTableIdentity) {
    if (tablesIdentities[expectedTable._.id] !== checkTableIdentity)
        throw new Error("A row was passed that does not belong to this table.");
};

/**
 * Checks the passed array of column names to ensure they are valid and to
 * ensure there are no duplicates. If a super set is specified, all column
 * names must also exist in the super set.
 * @param {Array} columnNames
 * @param {Array} superSet (optional)
 */
var checkColumnNames = function(columnNames, superSet) {
    if (columnNames == null || columnNames.length == 0) throw new Error("No column names specified");
    var cNames = {};
    newArray.apply(null,columnNames).each(function(name) {
        if (!/^([a-zA-Z_][a-zA-Z0-9_$]*)$/.test(name)) throw new Error("Invalid column name: " + name);
        if (cNames[name]) throw new Error("Duplicate column name: " + name);
        cNames[name] = true;
        if (superSet && !superSet.include(name)) throw new Error("Column name not found: " + name);
    });
};

/**
 * @param criteria The criteria to assess cost
 * @return The estimated cost the test one row
 */
var calculateSingleRowCriteriaCost = function(criteria) {
    return criteria.inject(criteria.length, function(cost, c) {
        switch (c.operator) {
            case "between": return cost + 1; // one extra check
            case "in": return cost + c.value.length - 1; // one extra for each item
            default: return cost;
        }
    });
};

/**
 * Build an index signature for the specified columns
 * @param columnNames
 */
var buildIndexSignature = function(columnNames) {
    return "[" + columnNames.join(",") + "]";
};

/**
 * Logs a message. Unified logging function for DataTable.
 * @param message
 */
var log = (typeof(console) == "object" && console.log) ? function(message) { console.log(message); } : function() {};

/**
 * @constructor Builds a new DataTable
 * @param {Array} columnNames An array of column names that will exist as
 *     properties of all data row objects in this table.
 */
DataTable = function(columnNames) {
    checkColumnNames(columnNames);
    this._ = { indicies: newArray(), rows: newArray(), columnNames: extend(columnNames, ary), paranoia: false,
               verbose: false, active: function() {}, id: "table-" + new Date().getTime().toString(16) };
    var proto = extend(["$"].concat(columnNames),ary).inject({}, function(proto, name) {
        proto[name] = { toJSON: function() { return "object." + name; } };
        return proto;
    });
    this._.clone = new Function("object", "return " + toJSON(proto) + ";"); // fast clone function for rows
    var markFunctionSource = columnNames.collect(function(name) {
        return "if (object.name !== original.name) changed = mark.name = true;".replace(/name/g, name);
    }).join("\n");
    markFunctionSource = "var changed = false;\n" + markFunctionSource + "\nreturn changed;";
    this._.markChangedColumns = new Function("object", "original", "mark", markFunctionSource);
    tablesIdentities[this._.id] = {};
};

/**
 * Adds a new index to this table, of locates an existing index on the same
 * columns.
 * @param {Array} columnNames The columns, in order, to index.
 * @retrun The index
 */
DataTable.prototype.index = function(columnNames) {
    var self = this;
    if (arguments.length == 0) return self._.indicies.collect(function(i) { return i.columns.pluck("name"); });
    self._.active();
    checkColumnNames(columnNames, self._.columnNames);
    var signature = buildIndexSignature(columnNames);
    var index = self._.indicies.find(function(ix) { return ix.signature == signature; });
    if (!index) {
        index = new DataTable.Index(self, columnNames);
        index.rowsAdded(self._.rows);
        self._.indicies.push(index);
    }
    return index;
};

/**
 * Adds rows to this table
 * @param {Array} rows
 * @return {Array} the inserted data row objects.
 */
DataTable.prototype.insert = function(rows) {
    var self = this;
    self._.active();
    rows = (rows && rows.constructor === Array) ? extend(rows.concat(), ary) : newArray(rows);
    var result = rows.collect(function(row) {
        if (row.$) return; // row is already in the table
        row = self._.clone(row);
        var index = self._.rows.length;
        row.$ = function() {
            self._.active();
            switch (arguments.length) {
                case 0:
                    return self._.clone(row); // default: clone(ROW_META_DATA.ORIGINAL)
                case 1:
                    if (arguments[0] === ROW_META_DATA.INDEX) return index;
                    if (arguments[0] === ROW_META_DATA.ORIGINAL) return row;
                    if (arguments[0] === ROW_META_DATA.TABLE_ID) return tablesIdentities[self._.id];
                    break;
                case 2:
                    if (arguments[0] === ROW_META_DATA.INDEX) { index = arguments[1]; return this; };
                    if (arguments[0] === ROW_META_DATA.ORIGINAL) {
                        row = arguments[1];
                        row.$ = arguments.callee;
                        return this;
                    };
                    return this;
            }
        };
        self._.rows.push(row);
        return row;
    });
    if (self._.verbose)  {
        log("inserted " + result.length + " row(s):\n\t" + result.collect(function(r) {
            return toJSON(r);
        }).join("\n\t"));
    }
    self._.indicies.each(function(i) { i.rowsAdded(result); });
    if (self._.paranoia) self.validateIndex();
    return result.collect(this._.clone);
};

/**
 * Removes rows from this table
 * @param {Array} rows
 */
DataTable.prototype.remove = function(rows) {
    var self = this;
    self._.active();
    rows = (rows && rows.constructor === Array) ? extend(rows.concat(), ary) : newArray.apply(null,rows);
    var origRows = rows.collect(function(r) {
        checkTableIdentity(self, r.$(ROW_META_DATA.TABLE_ID));
        return r.$();
    });
    self._.indicies.each(function(i) { i.rowsRemoved(origRows); });
    origRows.each(function(row) {
        if (self._.rows.length > 1) {
            var last = self._.rows.last();
            if (row != last) {
                var indexToOverwrite = row.$(ROW_META_DATA.INDEX);
                self._.rows[indexToOverwrite] = last;
                last.$(ROW_META_DATA.INDEX, indexToOverwrite);
            }
        }
        self._.rows.length--;
        delete row.$;
    });
    rows.each(function(r) { delete r.$; });
    if (self._.verbose)  {
        log("removed " + rows.length + " row(s):\n\t" + rows.collect(function(r) {
            return toJSON(r);
        }).join("\n\t"));
    }
    if (self._.paranoia) self.validateIndex();
};

/**
 * Updates rows that were obtained from this table
 * @param {Array} rows
 */
DataTable.prototype.update = function(rows) {
    var self = this;
    self._.active();
    var changedColumns = {};
    rows = (rows && rows.constructor === Array) ? extend(rows.concat(), ary) : newArray(rows);
    rows = rows.findAll(function(r) {
        checkTableIdentity(self, r.$(ROW_META_DATA.TABLE_ID));
        return self._.markChangedColumns(r, r.$(), changedColumns);
    });
    var oldRows = rows.collect(function(r) { return r.$(); });
    if (rows.length == 0) return;
    self._.indicies.each(function(i) {
        if (i.columns.any(function(column) { return Boolean(changedColumns[column.name]); })) {
            i.rowsRemoved(oldRows);
            if (self._.paranoia) i.validateIndex();
            i.rowsAdded(rows);
            if (self._.paranoia) i.validateIndex();
        }
    });
    rows.each(function(r) {
        var newRow = self._.clone(r);
        newRow.$(ROW_META_DATA.ORIGINAL, newRow);
        self._.rows[r.$(ROW_META_DATA.INDEX)] = newRow;
    });
    if (self._.verbose)  {
        var cols = 0;
        for (var k in changedColumns) if (changedColumns.hasOwnProperty(k)) ++cols;
        log("updated " + rows.length + " row(s), touching " + cols + " column(s):\n\t" +
            rows.collect(function(r) {
            return toJSON(r);
        }).join("\n\t"));
    }
};

/**
 * Finds rows in this table matching the specified criteria
 * @param {String} columnName The column to test
 * @param {String} operator One of the following:
 *     <, <=, ==, >=, >, !=, between, in
 * @param {String|Number|Boolean|Range|Array} value
 *     Range is used for "between" operations
 *     Array is used for "in" operations
 */
DataTable.prototype.findWhere = function(columnName, operator, value) {
    var self = this;
    self._.active();
    function checkOperatorAndValue(op) {
        if (!/^([=!<>]=|[<>]|between|in)$/.test(op)) throw new Error("Unknown operator: " + op);
    }
    operator = operator.toLowerCase();
    checkColumnNames([columnName], self._.columnNames);
    checkOperatorAndValue(operator, value);
    var criteria = newArray({columnName:columnName, operator:operator, value:value});
    return {
        /**
         * Further narrows rows in this table matching the specified criteria
         * @param {String} columnName The column to test
         * @param {String} operator One of the following:
         *     <, <=, ==, >=, >, !=, between, in
         * @param {String|Number|Boolean|Range|Array} value
         *     Range is used for "between" operations
         *     Array is used for "in" operations
         */
        and: function(columnName, operator, value) {
            self._.active();
            operator = operator.toLowerCase();
            checkColumnNames([columnName], self._.columnNames);
            checkOperatorAndValue(operator, value);
            criteria.push({columnName:columnName, operator:operator, value:value});
            return this;
        },
        /**
         * Processes the accumulated criteria and applies it to the data in
         * this table. The returned rows are cloned and suitable for
         * manipulation, then may be passed back to update().
         */
        getRows: function() {
            self._.active();
            var worstCase = {
                cost: self._.rows.length * calculateSingleRowCriteriaCost(criteria),
                criteriaUnused: criteria,
                reduce: function() { return self._.rows; },
                indexSignature: "<table scan>"
            };
            var verbose = self._.verbose;
            if (verbose) {
                log("Analysis of (" + criteria.collect(function(c) {
                    return [c.columnName,c.operator,toJSON(c.value)].join(" ");
                }).join(" AND ") + "):");
                log("\t" + worstCase.indexSignature + ": cost=" + worstCase.cost);
            }
            var bestCase = self._.indicies.inject(worstCase, function(bestCase, index) {
                var thisCase = index.computeCost(criteria);
                if (verbose) log("\t" + thisCase.indexSignature + ": cost=" + thisCase.cost);
                return (bestCase.cost > thisCase.cost) ? thisCase : bestCase;
            });
            if (verbose) log("Using " + bestCase.indexSignature);
            var matchedRows = bestCase.reduce();
            if (bestCase.criteriaUnused.length) {
                if (verbose) {
                    log("Applying remaining criteria on " + matchedRows.length + " row(s): (" +
                        bestCase.criteriaUnused.collect(function(c) {
                        return [c.columnName,c.operator,toJSON(c.value)].join(" ");
                    }).join(" AND ") + ")\n  " + matchedRows.collect(function(r) {
                        return toJSON(r);
                    }).join("\n  "));
                }
                bestCase.criteriaUnused.each(function (criterion) {
                    var comparator = DataTable.Comparator;
                    var include = null;
                    switch (criterion.operator) {
                        case "==": include = function(value) { return comparator(value, criterion.value) == 0; }; break;
                        case "!=": include = function(value) { return comparator(value, criterion.value) != 0; }; break;
                        case "<=": include = function(value) { return comparator(value, criterion.value) <= 0; }; break;
                        case "<" : include = function(value) { return comparator(value, criterion.value) <  0; }; break;
                        case ">=": include = function(value) { return comparator(value, criterion.value) >= 0; }; break;
                        case ">" : include = function(value) { return comparator(value, criterion.value) >  0; }; break;
                        case "between":
                        case "in":
                            var value = criterion.value instanceof DataTable.Set
                                        ? criterion.value
                                        : (criterion.value instanceof Array
                                          ? new DataTable.Set(criterion.value)
                                          : criterion.value);
                            include = bind(value.include, value); break;
                    }
                    matchedRows = matchedRows.findAll(function(row) { return include(row[criterion.columnName]); });
                });
            }
            if (verbose)  {
                log("found " + matchedRows.length + " row(s):\n\t" + matchedRows.collect(function(r) {
                    return toJSON(r);
                }).join("\n\t"));
            }
            return matchedRows.collect(function(r) { return self._.clone(r); });
        }
    };
};

/**
 * Remove this table breaks down data structures for easier garbage
 * collection. Any further calls to this table or any row or data structure
 * associated with it will throw an error.
 */
DataTable.prototype.drop = function() {
    this._.active();
    this._.active = function() { throw new Error("Table has been dropped"); };
};

/**
 * Returns all rows in this table. The returned rows are cloned and
 * suitable for manipulation, then may be passed back to update().
 */
DataTable.prototype.getRows = function() {
    this._.active();
    return this._.rows.collect(this._.clone);
};

/**
 * Returns the number of rows in this table.
 */
DataTable.prototype.getCount = function() {
    this._.active();
    return this._.rows.length;
};

/**
 * Utility method that validates all indexes on the table. This routine is
 * used for testing.
 */
DataTable.prototype.validateIndex = function() {
    this._.active();
    this._.indicies.each(function(ix) { ix.validateIndex(); });
};

/**
 * Enables paranoia mode to check the integrity of all indexes every time
 * data is modified.
 * @param {Boolean} enable (optional)
 */
DataTable.prototype.paranoia = function(enable) {
    this._.active();
    if (arguments.length == 0) return this._.paranoia;
    this._.paranoia = Boolean(enable);
};

/**
 * Enables verbose mode to log insert, update, delete and find operations
 * to the console.
 * @param {Boolean} enable (optional)
 */
DataTable.prototype.verbose = function(enable) {
    this._.active();
    if (arguments.length == 0) return this._.verbose;
    this._.verbose = Boolean(enable);
};

/**
 * Override the logging mechanism, for demonstration purposes only.
 * @param logger
 */
DataTable.logger = function(logger) {
    if (arguments.length == 0) return log; else log = logger || function(){};
};

/**
 * A basic comparator function compatible with Array.sort(). Null/undefined
 * values are pushed to the end of the sorted collection.
 * @param l
 * @param r
 * @return -1, 0, or 1, if the left value is less than, equal, or greater than
 *     the right value.
 */
DataTable.Comparator = function(l,r) { return l == r ? 0 : l == null || l > r ? 1 : -1; };

/**
 * Extends the basic comparator by plucking properties from the left and/or
 * right side object values.
 * <p>
 * If only one argument is specified, the same name will be plucked from both
 * left and right value object when performing the comparison. If no arguments
 * are specified, or both have no value, CA.DataTable.Comparator is returned.
 * @param {String} lName The name to pluck from the left side, or null to
 *     compare the left value directly.
 * @param {String} rName The name to pluck from the right side, or null to
 *     compare the right value directly.
 * @return A comparator function suitable for use with Array.sort().
 */
DataTable.Comparator.pluck = function(lName, rName) {
    if (arguments.length == 1) rName = lName;
    if (lName && rName) return function(l, r) { return DataTable.Comparator(l[lName], r[rName]); };
    else if (lName) return function(l, r) { return DataTable.Comparator(l[lName], r); };
    else if (rName) return function(l, r) { return DataTable.Comparator(l, r[rName]); };
    else return DataTable.Comparator;
};

/**
 * @constructor Builds a new Index
 * @param {Array} columnNames A list of column names to build an index for.
 */
DataTable.Index = function(table, columnNames) {
    var self = this;
    self.table = table;
    self.columns = extend(columnNames, ary).collect(function(cn) {
        return {
            name: cn,
            comparator: DataTable.Comparator.pluck(cn)
        };
    });
    self.signature = buildIndexSignature(columnNames);
    self.index = newArray();
    self.index.total = 0;
    self.active = function() {};
};

/**
 * A utility method to calculate an approximate cost to apply the passed
 * criteria. If the criteria specifies columns not indexed, the returned
 * cost includes the estimated effort to build the remaining data set and
 * perform a brute force search against it.
 * @param {Array} criteria A list of criteria that all rows are expected to
 *     meet.
 * @return {Object} An object containing the following:
 *     {Number} cost: expressed as an estimate of the number of loop
 *         iterations or criteria tests required to fully match the passed
 *         criteria.
 *     {Array} criteriaUnused: An array of criteria that will still need to
 *         be applied to the rows returned from reduce().
 *     {Function} reduce: A function that will execute the related criteria
 *         and return a reduced row set. This row set will need to be
 *         filtered by any criteria in unusedCriteria.
 *     {String} indexName: A human readable list of the columns used in
 *         this index. Used primarily in troubleshooting.
 */
DataTable.Index.prototype.computeCost = function(criteria) {
    var self = this;
    self.active();
    var cost = 0;
    var expectedRows = self.index.total;
    var criteriaUsed = newArray();
    var criteriaUnused = criteria;
    var costIncludesChildren = false;
    var subindex = self.index;
    var compareValues = DataTable.Comparator.pluck("value", null);
    this.columns.each(function(column) {
        var criterion = criteria.find(function(c) { return c.columnName == column.name; });
        if (!criterion) throw _$break;
        var log2Cost = simpleLog2Cost(subindex.length);
        cost += log2Cost;
        if (!costIncludesChildren && expectedRows > 0) {
            /**
             * Looks up a single value in the current sub-index and update
             * the matchIndex and foundExactMatch properties.
             * @param value
             * @param beforeOrAfter -0.5, 0, or 0.5 to indicate if the
             *     returned value should be the preceding, null, or
             *     successive entry in the index.
             */
            function getIndexEntry(value, beforeOrAfter) {
                var i = self.binarySearch(subindex, value, compareValues);
                if (i == Math.floor(i) && i >= 0 && i < subindex.length) {
                    foundExactMatch = true;
                    matchedIndex = i;
                    return subindex[i];
                } else {
                    foundExactMatch = false;
                    matchedIndex = i + beforeOrAfter;
                    return subindex[matchedIndex] || {subtotal: i < 0 ? 0 : subindex.total,
                                                      size: 0, data: newArray()};
                }
            }
            var entry = null;
            var foundExactMatch = true;
            var matchedIndex = 0;
            var matchedIndexCount = 0;
            var matchExact = 0;
            var matchBefore = -0.5;
            var matchAfter = 0.5;
            switch (criterion.operator) {
                case "==":
                    entry = getIndexEntry(criterion.value, matchExact);
                    expectedRows = foundExactMatch ? entry.size : 0;
                    matchedIndexCount = (foundExactMatch) ? 1 : 0;
                    break;
                case "!=":
                    entry = getIndexEntry(criterion.value, matchExact);
                    expectedRows = subindex.total - (foundExactMatch ? entry.size : 0);
                    matchedIndexCount = subindex.length - (foundExactMatch ? 1 : 0);
                    costIncludesChildren = true;
                    break;
                case "<=":
                    entry = getIndexEntry(criterion.value, matchBefore);
                    expectedRows = entry.subtotal;
                    matchedIndexCount = matchedIndex + 1;
                    costIncludesChildren = true;
                    break;
                case "<":
                    entry = getIndexEntry(criterion.value, matchBefore);
                    expectedRows = entry.subtotal - (foundExactMatch ? entry.size : 0);
                    matchedIndexCount = matchedIndex + 1;
                    costIncludesChildren = true;
                    break;
                case ">=":
                    entry = getIndexEntry(criterion.value, matchAfter);
                    expectedRows = subindex.total - (entry.subtotal - (foundExactMatch ? entry.size : 0));
                    matchedIndexCount = subindex.total - matchedIndex + (foundExactMatch ? 1 : 0);
                    costIncludesChildren = true;
                    break;
                case ">":
                    entry = getIndexEntry(criterion.value, matchAfter);
                    expectedRows = subindex.total - entry.subtotal;
                    matchedIndexCount = subindex.total - matchedIndex + 1;
                    costIncludesChildren = true;
                    break;
                case "between": // value is a Range
                    cost += log2Cost; // cost for the second binary search
                    entry = getIndexEntry(criterion.value.start, matchAfter);
                    expectedRows = 0 - entry.subtotal;
                    matchedIndexCount = 0 - matchedIndex;
                    entry = getIndexEntry(criterion.value.end, matchAfter);
                    expectedRows += entry.subtotal - (foundExactMatch || criterion.value.exclusive ? entry.size : 0);
                    matchedIndexCount += matchedIndex + (foundExactMatch || criterion.value.exclusive ? 1 : 0);
                    costIncludesChildren = true;
                    break;
                case "in": // value is an array or possible values
                    if (criterion.value.length == 1) {
                        // one entry, same logic as "=="
                        entry = getIndexEntry(criterion.value[0], matchExact);
                        expectedRows = foundExactMatch ? entry.size : 0;
                        matchedIndexCount = (foundExactMatch) ? 1 : 0;
                    } else {
                        cost += log2Cost * (simpleLog2Cost(criterion.value.length) - 1); // adjust for the number of entries to match
                        if (subindex.length > 0) {
                            expectedRows = Math.min(subindex.total, Math.ceil((criterion.value.length * subindex.total) / subindex.length));
                        } else {
                            expectedRows = 0;
                        }
                        matchedIndexCount = criterion.value.length;
                        costIncludesChildren = true;
                    }
                    break;
            }
            cost += expectedRows;
            if (costIncludesChildren || entry == null) {
                subindex = { length: matchedIndexCount, total: expectedRows };
            } else {
                subindex = entry.data;
            }
        } else if (expectedRows > 0) {
            switch (criterion.operator) {
                case "==":
                    expectedRows = Math.ceil(subindex.total / subindex.length);
                    matchedIndexCount = expectedRows;
                    break;
                case "!=":
                    expectedRows = subindex.total - Math.ceil(subindex.total / subindex.length);
                    matchedIndexCount = expectedRows;
                    break;
                case "<=":
                case ">=":
                    expectedRows = Math.ceil(subindex.total * 0.667);
                    matchedIndexCount = Math.ceil(subindex.length * 0.667);
                    break;
                case "<":
                case ">":
                    expectedRows = Math.floor(subindex.total * 0.667);
                    matchedIndexCount = Math.floor(subindex.length * 0.667);
                    break;
                case "between":
                    expectedRows = Math.ceil(subindex.total * 0.333);
                    matchedIndexCount = Math.ceil(subindex.length * 0.333);
                    break;
                case "in":
                    if (criterion.value.length == 1) {
                        // one entry, same logic as "=="
                        expectedRows = Math.ceil(subindex.total / subindex.length);
                        matchedIndexCount = expectedRows;
                    } else {
                        cost += log2Cost * (simpleLog2Cost(criterion.value.length) - 1); // adjust for the number of entries to match
                        if (subindex.total > 0) {
                            expectedRows = Math.min(subindex.total, (criterion.value.length * subindex.total) / subindex.length);
                        } else {
                            expectedRows = 0;
                        }
                        matchedIndexCount = Math.min(criterion.value.length, subindex.length);
                    }
                    break;
            }
            cost += expectedRows;
            subindex = { length: Math.min(matchedIndexCount, expectedRows), total: expectedRows };
        }
        criteriaUsed.push(criterion);
        criteriaUnused = criteriaUnused.without(criterion);
    });
    cost += expectedRows * (calculateSingleRowCriteriaCost(criteriaUnused) + 1);
    /**
     * Applies the criteria and generates the reduced set. This result
     * still needs to have unused criteria applied to it.
     */
    function reduce() {
        self.active();
        var data = newArray({data:self.index});
        function dataOf(ix) { return ix ? newArray(ix) : newArray(); }
        criteriaUsed.each(function(criterion) {
            var found = newArray();
            function appendToFound(indexEntry) { append(found, indexEntry); }
            data.pluck("data").forEach(function(subindex) {
                /**
                 * Looks up a single value in the current sub-index and update
                 * the matchIndex and foundExactMatch properties.
                 * @param value
                 * @param beforeOrAfter -0.5, 0, or 0.5 to indicate if the
                 *     returned value should be the preceding, null, or
                 *     successive entry in the index.
                 */
                function getIndexEntry(value, beforeOrAfter) {
                    var i = self.binarySearch(subindex, value, compareValues);
                    if (i == Math.floor(i) && i >= 0 && i < subindex.length) {
                        foundExactMatch = true;
                        matchedIndex = i;
                        return subindex[i];
                    } else {
                        foundExactMatch = false;
                        matchedIndex = i + beforeOrAfter;
                        return subindex[matchedIndex] || {subtotal: i < 0 ? 0 : subindex.total,
                                                          size: 0, data: newArray()};
                    }
                }
                var entry = null;
                var foundExactMatch = true;
                var matchedIndex = 0;
                var matchExact = 0;
                var matchBefore = -0.5;
                var matchAfter = 0.5;
                switch (criterion.operator) {
                    case "==":
                        entry = getIndexEntry(criterion.value, matchExact);
                        if (foundExactMatch) appendToFound(dataOf(entry));
                        break;
                    case "!=":
                        entry = getIndexEntry(criterion.value, matchExact);
                        if (!foundExactMatch) {
                            subindex.slice(0, matchedIndex).forEach(appendToFound);
                            subindex.slice(matchedIndex + 1).forEach(appendToFound);
                        } else subindex.forEach(appendToFound);
                        break;
                    case "<=":
                        entry = getIndexEntry(criterion.value, matchBefore);
                        if (matchedIndex >= 0) {
                            subindex.slice(0, matchedIndex + 1).forEach(appendToFound);
                        }
                        break;
                    case "<":
                        entry = getIndexEntry(criterion.value, matchBefore);
                        if (matchedIndex >= 0) {
                            subindex.slice(0, matchedIndex + (foundExactMatch ? 0 : 1)).forEach(appendToFound);
                        }
                        break;
                    case ">=":
                        entry = getIndexEntry(criterion.value, matchAfter);
                        subindex.slice(Math.max(0, matchedIndex)).forEach(appendToFound);
                        break;
                    case ">":
                        entry = getIndexEntry(criterion.value, matchAfter);
                        subindex.slice(Math.max(matchedIndex + (foundExactMatch ? 1 : 0))).forEach(appendToFound);
                        break;
                    case "between":
                        entry = getIndexEntry(criterion.value.start, matchAfter);
                        var begin = Math.max(0, matchedIndex);
                        entry = getIndexEntry(criterion.value.end, matchAfter);
                        var end = matchedIndex + ((foundExactMatch && !criterion.value.exclusive) ? 1 : 0);
                        subindex.slice(begin, end).forEach(appendToFound);
                        break;
                    case "in":
                        // todo: sort the values and compare against the index in order
                        extend(criterion.value, ary).uniq().forEach(function(value) {
                            var entry = getIndexEntry(value, matchExact);
                            if (foundExactMatch) appendToFound(dataOf(entry));
                        });
                        break;
                }
            });
            data = found;
        });
        for (var i = criteriaUsed.length; i <= self.columns.length; i++) {
            data = extend(data.inject([], function(buffer, d) {
                return buffer.concat(d.data);
            }), ary);
        }
        return data;
    }
    return {
        cost: cost,
        criteriaUnused: criteriaUnused,
        reduce: reduce,
        indexSignature: self.signature
    };
};

/**
 * @param {Array} index The index to search
 * @param {Object} value The value to search for
 * @param {Function} comparator The comparator to use.
 * @param {Number} lBound The lower boundary to search within
 * @param {Number} uBound The upper boundary to search within
 */
DataTable.Index.prototype.binarySearch = function(index, value, comparator, lBound, uBound) {
    if (lBound == null) lBound = -1;
    if (uBound == null) uBound = index.length;
    var r = uBound, l = lBound, m;
    while (r - l > 1) {
        if (comparator(index[m = r + l >> 1], value) < 0) l = m; else r = m;
    }
    var result = index[r] && comparator(index[r], value) == 0 ? r : r - 0.5;
    return result < 0 ? -1 : result > uBound - 1 ? uBound : result;
};

/**
 * Builds an index on "rows" and merges it with this index.
 * @param {Array} rows The data to build an index on
 */
DataTable.Index.prototype.buildIndex = function(rows) {
    this.active();
    /**
     * Builds a single level index.
     * @param {Array} rows The rows to index. This array is sorted in
     *     place.
     * @param {String} columnName The property to index on each row
     * @param {Function} comparator The function to use when comparing
     */
    function buildShallowIndex(rows, columnName, comparator) {
        rows.sort(comparator);
        var index = newArray();
        var lastEntry = { value: {}, subtotal: 0 };
        rows.each(function(r) {
            if (r[columnName] === lastEntry.value) {
                lastEntry.data.push(r);
                lastEntry.size++;
                lastEntry.subtotal++;
            } else {
                lastEntry = {
                    value: r[columnName],
                    data: newArray(r),
                    size: 1,
                    subtotal: lastEntry.subtotal + 1
                };
                index.push(lastEntry);
            }
        });
        index.total = lastEntry.subtotal;
        return index;
    }
    /**
     * Builds an index on the passed data rows. Recursion is used to build
     * sub-indexes on each index entry if columns contains more than one
     * value.
     * @param {Array} rows The data to index
     * @param {Array} columns An array of column objects, each containing a
     *     name property and a comparator function.
     */
    function buildIndex(rows, columns) {
        var index = buildShallowIndex(extend(rows.concat(), ary), columns[0].name, columns[0].comparator);
        if (columns.length > 1) {
            var remainingColumns = columns.slice(1);
            for (var i = 0; i < index.length; i++) index[i].data = buildIndex(index[i].data, remainingColumns);
        }
        return index;
    }
    return buildIndex(rows, this.columns);
};

/**
 * Builds an index on "rows" and merges it with this index.
 * @param {Array} leftIndex The index to merge into.
 * @param {Array} rightIndex The index to merge from.
 * @param {Function} callbacks.processLeftSideEntry(leftEntry, previousRightEntry)
 *     Invoked when an index entry is found only on the left side
 * @param {Function} callbacks.processRightSideEntry(previousLeftEntry, rightEntry)
 *     Invoked when an index entry is found only on the right side. May
 *     return a value to be inserted on the left side.
 * @param {Function} callbacks.mergeLeftAndRightEntries(leftEntry, rightEntry)
 *     Invoked when an index value is found on both indexes. Only called
 *     for merging row data.
 * @param {Function} callbacks.mergeTotals(leftIndex, rightIndex)
 *     Invoked when an index value is found on both indexes. Only called
 *     for merging sub-index data, after the sub-index has been merged
 *     recursively.
 */
DataTable.Index.prototype.mergeIndex = function(leftIndex, rightIndex, callbacks) {
    this.active();
    /**
     * Walks both indexes side-by-side comparing values and calling the
     * appropriate callbacks to update the data.
     * @param {Array} left Left-side index or the index collection that is
     *     part of this index object.
     * @param {Array} right Right-side index. Usually the smaller index
     *     built from updated data.
     * @param {Function} callbacks.processLeftSideEntry(leftEntry, previousRightEntry)
     *     Invoked when an index entry is found only on the left side
     * @param {Function} callbacks.processRightSideEntry(previousLeftEntry, rightEntry)
     *     Invoked when an index entry is found only on the right side. May
     *     return a value to be inserted on the left side.
     * @param {Function} callbacks.mergeLeftAndRightEntries(leftEntry, rightEntry, isRowData)
     *     Invoked when an index value is found on both indexes.
     * @param {Function} callbacks.mergeTotals(leftIndex, rightIndex)
     *     Invoked when an index value is found on both indexes. Only called
     *     for merging sub-index data, after the sub-index has been merged
     *     recursively.
     * @param {Number} depth The remaining depth in a compound index before
     *     row data is found.
     */
    function mergeIndex(left, right, callbacks, depth) {
        var maxLeft = left.length;
        var maxRight = right.length;
        /**
         * Invoked when an index entry is found only on the left side
         */
        function processLeftSideEntry() {
            callbacks.processLeftSideEntry(leftEntry, (r > 0) ? right[r - 1] : null);
            l++;
        }
        /**
         * Invoked when an index entry is found only on the right side. May
         * insert a value on the left side.
         */
        function processRightSideEntry() {
            var newEntry = callbacks.processRightSideEntry((l > 0) ? left[l - 1] : null, rightEntry);
            if (newEntry) {
                left.splice(l, 0, newEntry);
                l++;
                maxLeft++;
            }
            r++;
        }
        /**
         * Invoked when an index value is found on both indexes.
         */
        function mergeLeftAndRightEntries() {
            if (depth <= 1) {
                callbacks.mergeLeftAndRightEntries(leftEntry, rightEntry, true);
            } else {
                mergeIndex(leftEntry.data, rightEntry.data, callbacks, depth - 1);
                callbacks.mergeLeftAndRightEntries(leftEntry, rightEntry, false);
            }
            if (leftEntry.size == 0) {
                left.splice(l, 1);
                maxLeft--;
            } else {
                l++;
            }
            r++;
        }
        for (var l = 0, r = 0; l < maxLeft || r < maxRight; ) {
            var leftEntry = left[l];
            var rightEntry = right[r];
            var bothInBounds = l < maxLeft && r < maxRight;
            if (bothInBounds && leftEntry.value == rightEntry.value) mergeLeftAndRightEntries();
            else if (bothInBounds ? leftEntry.value < rightEntry.value : l < maxLeft) processLeftSideEntry();
            else processRightSideEntry();
        }
        callbacks.mergeTotals(left, right, depth <= 1);
    }
    mergeIndex(leftIndex, rightIndex, callbacks, this.columns.length);
};

/**
 * Adds the passed rows to the index.
 * @param {Array} rows
 */
DataTable.Index.prototype.rowsAdded = function(rows) {
    this.active();
    var subIndexComparator = DataTable.Comparator.pluck("value");
    var rowDataComparator = DataTable.Comparator.pluck(this.columns.last().comparator);
    this.mergeIndex(this.index, this.buildIndex(rows), {
        /**
         * Adjusts the subtotal on the left side.
         * @param leftEntry
         * @param previousRightEntry
         */
        processLeftSideEntry: function(leftEntry, previousRightEntry) {
            if (previousRightEntry) leftEntry.subtotal += previousRightEntry.subtotal;
        },
        /**
         * @param previousLeftEntry
         * @param rightEntry
         * @return A near-clone of the right side, to be inserted into the
         *     left side.
         */
        processRightSideEntry: function(previousLeftEntry, rightEntry) {
            rightEntry = { // fast clone
                value: rightEntry.value,
                data: rightEntry.data,
                size: rightEntry.size,
                subtotal: rightEntry.size
            };
            if (previousLeftEntry) {
                rightEntry.subtotal += previousLeftEntry.subtotal;
            }
            return rightEntry;
        },
        /**
         * Adds right-side aggregated row statistics to the left side.
         * @param leftEntry
         * @param rightEntry
         * @param isRowData
         */
        mergeLeftAndRightEntries: function(leftEntry, rightEntry, isRowData) {
            if (isRowData) append(leftEntry.data, rightEntry.data);
            leftEntry.size += rightEntry.size;
            leftEntry.subtotal += rightEntry.subtotal;
        },
        /**
         * Adds right-side aggregated row statistics to the left side.
         * @param leftIndex
         * @param rightIndex
         * @param isRowData
         */
        mergeTotals: function(leftIndex, rightIndex, isRowData) {
            leftIndex.total += rightIndex.total;
            leftIndex.sort(subIndexComparator);
        }
    });
};

/**
 * Removes the passed rows to the index.
 * @param {Array} rows
 */
DataTable.Index.prototype.rowsRemoved = function(rows) {
    this.active();
    function canonize(r) { return r.$; }
//		function canonize(r) { return r.$(ROW_META_DATA.INDEX); } // slower, but better for testing
    this.mergeIndex(this.index, this.buildIndex(rows), {
        /**
         * Adjusts the subtotal on the left side.
         * @param leftEntry
         * @param previousRightEntry
         */
        processLeftSideEntry: function(leftEntry, previousRightEntry) {
            if (previousRightEntry) {
                leftEntry.subtotal -= previousRightEntry.subtotal;
            }
        },
        /**
         * Should never be called. Throws an error if it is.
         * @param previousLeftEntry
         * @param rightEntry
         */
        processRightSideEntry: function(previousLeftEntry, rightEntry) {
            throw new Error("How did a value in the sublist, not start in the list?\n" +
                            "Found " + toJSON(rightEntry)) + " after " + toJSON(previousLeftEntry);
        },
        /**
         * Deducts right-side aggregated row statistics to the left side.
         * @param leftEntry
         * @param rightEntry
         * @param isRowData
         */
        mergeLeftAndRightEntries: function(leftEntry, rightEntry, isRowData) {
            if (isRowData) {
                // Leveraging the $ property shared by every row object, its clones, and even by the "original"
                var leftIdentity = leftEntry.data.collect(canonize);
                var rightIdentity = rightEntry.data.collect(canonize);
                for (var i = leftIdentity.length - 1; i >= 0; i--) { // runs backwards because the left side shrinks
                    if (rightIdentity.indexOf(leftIdentity[i]) >= 0) leftEntry.data.splice(i, 1);
                }
            }
            leftEntry.subtotal -= rightEntry.subtotal;
            leftEntry.size -= rightEntry.size;
        },
        /**
         * Deducts right-side aggregated row statistics to the left side.
         * @param leftIndex
         * @param rightIndex
         */
        mergeTotals: function(leftIndex, rightIndex) {
            leftIndex.total -= rightIndex.total;
        }
    });
};

/**
 * Utility used during troubleshooting to validate the integrity and
 * consistency of this index.
 */
DataTable.Index.prototype.validateIndex = function(index) {
    this.active();
    function check(index, columns, path) {
        var subtotal = 0;
        var lastValue = null;
        for (var i = 0; i < index.length; i++) {
            var ix = index[i];
            subtotal += ix.size;
            function localPath() { return path + ".{" + columns[0].name + ":" + toJSON(ix.value) + "}"; };
            if (ix.size == 0) {
                throw new Error("Index entry with a size of 0 at " + localPath());
            }
            if (ix.data == null) {
                throw new Error("Index entry with undefined data at " + localPath());
            }
            if (ix.data.length == 0) {
                throw new Error("Index entry with no data at " + localPath());
            }
            if (ix.data.length > ix.size) {
                throw new Error("Index entry with more data than the recorded size at " + localPath() + "; size " + ix.size + ", data.length " + ix.data.length);
            }
            if (i > 0 && ix.value == lastValue) {
                throw new Error("Index entry was duplicated at " + localPath() + "; duplicated " + toJSON(ix.value));
            }
            if (i > 0 && ix.value < lastValue) {
                throw new Error("Index entry was out of order at " + localPath() + "; found " + toJSON(ix.value) + " after " + toJSON(lastValue));
            }
            if (subtotal != ix.subtotal) {
                throw new Error("Subtotal was not correct at " + localPath() + "; computed " + subtotal + ", stored " + ix.subtotal);
            }
            if (columns.length > 1) {
                check(ix.data, columns.slice(1), localPath());
            } else if (ix.data.length != ix.size) {
                throw new Error("Final index entry where size was incorrect at " + localPath() + "; size " + ix.size + ", data.length " + ix.data.length);
            }
            lastValue = ix.value;
        }
        if (index.total != subtotal) {
            throw new Error("Total was not correct at " + localPath() + "; computed " + subtotal + ", stored " + index.total);
        }
    }
    check(index || this.index, this.columns, "index");
};

/**
 * Remove this index from its table and breaks down the index for easier
 * garbage collection.
 */
DataTable.Index.prototype.drop = function() {
    this.active();
    this.active = function() { throw new Erorr("Index has been dropped"); };
    var idx = this.table._.indicies.indexOf(this);
    if (idx >= 0) this.table._.indicies.splice(idx, 1);
    function unwindDependencies(data, depth) {
        if (depth > 0) for (var i = 0; i < data.length; i++) unwindDependencies(data[i].data, depth - 1);
        data.length = 0;
    }
    unwindDependencies(this.index, this.columnNames.length);
};

/**
 * Used to dump the entire contents of this index in a not-really-readable,
 * but more-readable-than-json format.
 */
DataTable.Index.prototype.toString = function() {
    var buffer = [];
    function append(index, prefix, columns) {
        if (columns.length > 0) {
            buffer.push(prefix + ".data(@column=" + toJSON(columns[0].name) + ") :");
            for (var i = 0; i < index.length; i++) {
                var childPrefix = prefix + ".data[" + i + "]";
                buffer.push(childPrefix + ".value = " + toJSON(index[i].value));
                append(index[i].data, childPrefix, columns.slice(1));
                buffer.push(childPrefix + ".size = " + index[i].size);
                buffer.push(childPrefix + ".subtotal = " + index[i].subtotal);
            }
            buffer.push(prefix + ".data.total = " + index.total);
        } else {
            var data = index;
            if (data.length > 3) {
                data = extend(data.slice(0,3).concat({toJSON:function(){ return "..."; }}), ary);
            }
            buffer.push(prefix + ".data: " + toJSON(data));
        }
        buffer.push(prefix + ".length = " + index.length);
    }
    append(this.index, "ix", this.columns);
    return buffer.join("\n");
};

/**
 * Used to dump the entire contents of this index in a mostly-readable HTML
 * format. Requires jQuery.
 * @param {Function} markRow A function that can be used to mark data in
 *     the output. The data row is passed to the function and the the
 *     result is true, the row is marked. (optional)
 * @param {Array} index Index data from buildIndex() to be rendered.
 *     Defaults to this index(). (optional)
 */
DataTable.Index.prototype.toHtml = function(markRow, index) {
    if (!jQuery) return "The <a href=\"http://jquery.com/\">jQuery</a> library is required to generate HTML";
    var isCorrupt = false;
    try {
        this.validateIndex(index || this.index);
    } catch(e) {
        isCorrupt = true;
        if(log) log(e);
    }

    var columnNames = this.table._.columnNames;
    var $j = jQuery.noConflict();
    var stylesheetBuffer = $j("<style/>").attr("type", "text/css").text([
        ".idx * { font-family:sans-serif; font-size:10px; }",
        ".idx .err { font-size:12px; font-weight:bold; background-color:#900; color:#fff; }",
        ".idx .cn TD { background-color:#cfc; font-weight:bold; }",
        ".idx TD { background-color:#ffc; text-align:left; vertical-align:top; padding:1px 2px; }",
        ".idx .mark TD { border:1px solid #f66; }",
        ".idx .ix { background-color:#ccf; }",
        ".ct { color:#999; }",
        ".idx TD.wh { background-color:#fff; color:#999; text-align:right; }"
    ].join("\n"));
    var tableBuffer = $j("<table/>").attr("cellspacing","2").addClass("idx");
    var tableHeadBuffer = $j("<thead/>");
    var tableBodyBuffer = $j("<tbody/>");
    var template = {
        row: $j("<tr/>"),
        cell: $j("<td/>"),
        footnote: $j("<div/>").addClass("ct").append($j("<span/>")).append($j("<br/>")).append($j("<span/>"))
    };
    var cNames = this.columns.inject({}, function(a,c) { a[c.name] = true; return a; });
    var rowCount = 0;

    /**
     * Build a footnote element for a table cell containing additional data
     * about an index entry.
     * @param {Number} rowCount
     * @param {Number} subindexCount
     */
    function footnote(rowCount, subindexCount) {
        var footnote = template.footnote.clone();
        footnote.find("SPAN:first").text("size:" + rowCount);
        footnote.find("SPAN:last").text("len:" + subindexCount);
        return footnote;
    }
    /**
     * If the index is corrupt, padding cells under
     * @param depth
     */
    function padEmptyCells(depth) {
        if (!isCorrupt) return;
        if (rowspans.lastDepth < depth) rowspans.lastDepth = rowspans.maxDepth;
        else if (rowspans.lastDepth == depth) {
            tableBodyBuffer.append(rowBuffer);
            rowBuffer.prepend(cell(String(++rowCount),"wh"));
            rowBuffer = template.row.clone();
            for (var j = 0; j < rowspans.length; j++) rowspans[j] = Math.max(rowspans[i] - 1, 0);
        }
        for (var i = rowspans.lastDepth; i > depth; i--) {
            if (rowspans[i] > 0) rowspans[i]--;
            else rowBuffer.append(cell(" ", "wh"));
        }
        rowspans.lastDepth = depth;
    }
    /**
     * Builds a table cell
     * @param {String} text
     * @param {String} css A CSS class (optional)
     * @param {Number} rowspan (optional)
     * @param {Object} footnote A jQuery object to add to the cell. (optional)
     * @param {String} title A tool tip to show on hover. (optional)
     */
    function cell(text, css, rowspan, footnote, title) {
        var buffer = template.cell.clone();
        if (css) buffer.addClass(css);
        if (rowspan > 1) buffer.attr("rowspan", rowspan);
        if (isCorrupt && rowspan) {
            while (rowspans[rowspans.lastDepth] > 0) {
                for (var pad = 0; pad < rowspans[rowspans.lastDepth]; pad++) rowBuffer.append(template.row.clone());
                for (var i = 0; i < rowspans.length; i++) rowspans[i] = Math.max(0, rowspans[i] - pad);
            }
            rowspans[rowspans.lastDepth] = rowspan;
        }
        buffer.text(text);
        if (footnote) buffer.append(footnote);
        if (title) buffer.attr("title", title);
        return buffer;
    }
    /**
     * Adds row data to the table
     * @param {Object} row
     */
    function appendData(row) {
        if (markRow && markRow(row)) rowBuffer.addClass("mark");
        columnNames.each(function(cn) { if (isCorrupt || !cNames[cn]) rowBuffer.append(cell(toJSON(row[cn]))); });
        tableBodyBuffer.append(rowBuffer);
        if (isCorrupt) rowBuffer.prepend(cell(String(++rowCount),"wh"));
        rowBuffer = template.row.clone();
    }
    /**
     * Adds index data to the table
     * @param {Array} index
     * @param {Number} depth
     */
    function appendIndex(index, depth) {
        var i, l;
        if (depth == 0) {
            for (i = 0, l = index.length; i < l; i++) {
                padEmptyCells(0);
                appendData(index[i]);
            }
        } else {
            for (i = 0, l = index.length; i < l; i++) {
                var ix = index[i];
                var fnote = ix.size > 2 && footnote(ix.size, ix.data.length);
                padEmptyCells(depth);
                rowBuffer.append(cell(toJSON(ix.value), "ix", ix.size, fnote, "subtotal:" + ix.subtotal));
                appendIndex(ix.data, depth - 1);
            }
        }
    }

    var rowBuffer = template.row.clone().addClass("cn");
    this.columns.each(function(c) { rowBuffer.append(cell(c.name, "ix")); });
    columnNames.each(function(cn) { if (isCorrupt || !cNames[cn]) rowBuffer.append(cell(cn)); });
    if (isCorrupt) {
        var rowspans = this.columns.collect(function() { return 0; }).concat(0);
        rowspans.maxDepth = this.columns.length;
        rowspans.lastDepth = -1;
        var corruptHeader = cell("Index is corrupt!", "err").attr("colspan", rowBuffer.children().length);
        tableHeadBuffer.append(template.row.clone().append(cell(" ", "wh")).append(corruptHeader));
        rowBuffer.prepend(cell(" ", "wh"));
    }
    tableHeadBuffer.append(rowBuffer);
    rowBuffer = template.row.clone();
    appendIndex(index || this.index, this.columns.length);

    tableBuffer.append(tableHeadBuffer);
    tableBuffer.append(tableBodyBuffer);

    return $j("<div/>").append(stylesheetBuffer).append(tableBuffer).children();
};

DataTable.Set = function(array) {
    this._$array = [];
    array = array || [];
    for (var i = 0, j = array.length; i < j; ++i) {
        this[i] = this._$array[i] = array[i];
    }
    this.__defineGetter__("length", function() { return array.length; });
    extend(this, ary);
};

DataTable.Set.prototype.indexOf = function(obj) {
    for (var i = 0, j = this.length; i < j; ++i) if (this[i] == obj) return i;
    return -1;
};

DataTable.Set.prototype.join = function(separator) {
    var a = [];
    for (var i = 0, j = this.length; i < j; ++i) a[i] = this[i];
    return a.join(separator);
};

DataTable.Set.prototype.toString = function() {
    return "[" + this.join(",") + "]";
};

DataTable.Set.of = function() {
    var a = [];
    for (var i = 0, j = arguments.length; i < j; ++i) a[i] = this[i];
    return new DataTable.Set(a);
};

DataTable.Range = function(begin, end) {
    extend(this, ary);
    this.each = function(f, ctx) {
        f = bind(f, ctx);
        try {
            for (var i = begin, j = 0; i <= end; ++i,++j) f(i, j);
        } catch(e) {
            if (e !== _$break) throw e;
        }
    };
    this.include = function(v) { return v >= begin && v <= end };
    this.uniq = function() { return this };
    this.last = function() { return end - 1; };
    this.toString = function() { return "[" + begin + ".." + end + "]" };
    this.toJSON = function() { return "{\"start\": " + begin + ", \"end\": " + end + "}" };
    this.__defineGetter__("length", function() { return end - begin + 1; });
    this.start = begin;
    this.end = end;
};

})(); // end of scoping function, invoke it
