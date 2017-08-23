'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Parser = function () {
    function Parser(separator, string) {
        _classCallCheck(this, Parser);

        this.separator = separator;
        this.string = string;
        this.parentesis = '(';
        this.ocurrence = new RegExp('(' + separator + ')|(\\()', 'i');
    }

    _createClass(Parser, [{
        key: 'nextOcurrence',
        value: function nextOcurrence(start) {
            var res = this.ocurrence.exec(this.string.slice(start));
            var lookIn = this.string.slice(start);
            console.log(lookIn);
            if (!res) {
                return null;
            }
            console.log(start);
            console.log(res[0]);
            var result = res[0];
            if (result === this.parentesis) {
                return this.nextOcurrence(this.getPar(this.string, start + this.string.slice(start).indexOf(result) + 1));
            } else if (result.match(new RegExp(this.separator, 'i'))) {
                var startOfMatch = start + this.string.slice(start).indexOf(result);
                console.log(startOfMatch);
                console.log(result);
                //const endOfMatch = start + startOfMatch + result.length;

                return { index: startOfMatch, match: result };
            } else {
                return null;
            }

            //if(result.ma)
        }
    }, {
        key: 'getPar',
        value: function getPar(string, start) {
            var res = /(\(|\))/g.exec(string.slice(start));
            var lookIn = string.slice(start);
            console.log();
            console.log(res);
            if (res[0] === '(') {
                return this.getPar(string, this.getPar(string, start + res.index + 1));
            } else if (res[0] === ')') {
                return start + res.index + 1;
            }
        }
    }, {
        key: 'getSection',
        value: function getSection(startIndex, firstSection) {
            var startMatchSearch = startIndex;
            if (!firstSection) {
                var resFirstMatch = this.nextOcurrence(startIndex);
                console.log('res first match', resFirstMatch);
                if (resFirstMatch == null) {
                    return null;
                }
                startMatchSearch = resFirstMatch.index + resFirstMatch.match.length;
            }
            var matchSearch = this.nextOcurrence(startMatchSearch);
            var section = null;
            if (matchSearch == null) {
                section = this.string.slice(startIndex);
            } else {
                section = this.string.slice(startIndex, matchSearch.index);
            }

            return section;
        }
    }, {
        key: 'getSections',
        value: function getSections() {
            var section = this.getSection(0, true);
            var sections = [];
            var cursor = 0;
            while (section != null) {
                sections.push(section.trim());
                cursor = section.length + cursor;
                console.log('cursor ', cursor);
                console.log('section ', section);
                section = this.getSection(cursor, false);
            }

            console.log(sections);
            return sections;
        }
    }]);

    return Parser;
}();

function getSelectElements(section) {
    var separator = ',';
    var parser = new Parser(separator, section);
    var sections = parser.getSections();
    sections = sections.map(eliminateComma);
    return sections;
}

function getFromElements(section) {
    var separator = '(left|right|inner|full)?(\\s+outer)?\\s+join';
    var parser = new Parser(separator, section);
    var sections = parser.getSections();
    if (sections[0]) {
        sections[0] = convertFromClause(sections[0]);
    }
    return sections;
}

function getWhereElements(section) {
    if (/(@\w+)/ig.exec(section) == null) {
        return {
            PreCondition: section
        };
    }
    var separator = '\\s+and\\s+|\\s+or\\s+';
    var parser = new Parser(separator, section);
    var sections = parser.getSections();
    sections = sections.reduce(convertCondition, {});
    return sections;
}

function convertCondition(value, condition, index, conditions) {
    var res = /(@\w+)/ig.exec(condition);
    if (res != null) {
        var parameter = res[0].slice(1);
        var resOperator = new Parser('\\s+and\\s+|\\s+or\\s+', condition).nextOcurrence(0);
        var operator = ' and ';
        var valueCondition = condition;
        if (resOperator != null) {
            operator = resOperator.match;
            valueCondition = condition.slice(resOperator.index + resOperator.match.length);
        }
        var conditionObject = {
            parameter: parameter,
            value: valueCondition,
            Operator: operator
        };
        if (/(\/\*.*opt.*\*\/)/ig.exec(condition) != null) {
            if (value.OptionalConditions != null) {
                value.OptionalConditions.push(conditionObject);
            } else {
                value.OptionalConditions = [conditionObject];
            }
        } else {
            if (value.RequiredConditions != null) {
                value.RequiredConditions.push(conditionObject);
            } else {
                value.RequiredConditions = [conditionObject];
            }
        }
        return value;
    } else {
        if (value.PreCondition != null) {
            value.PreCondition += " " + condition;
        } else {
            value.PreCondition = condition;
        }
        return value;
    }
}

function convertFromClause(join) {
    var res = new Parser('\\s+with\\s*\\(nolock\\)', join).nextOcurrence(0);
    if (res) {
        return join.slice(0, res.index);
    } else {
        return join;
    }
}

function getOrderByElements(section) {
    var separator = ',';
    var parser = new Parser(separator, section);
    var sections = parser.getSections();
    sections = sections.map(eliminateComma);
    return sections;
}

function eliminateComma(section, index) {
    if (index == 0) {
        return section;
    } else {
        return section.slice(1).trim();
    }
}

function parseQuery(query, farm, label, idProperty) {
    query = sanizateQuery(query);
    var selectClause = parseSection(query, 'select', 'from');
    var selects = getSelectElements(selectClause);
    var fromClause = parseSection(query, 'from', 'where|order\\s+by');
    var joins = getFromElements(fromClause);
    var whereClause = parseSection(query, 'where', 'order\\s+by');
    var conditions = null;
    if (whereClause) {
        conditions = getWhereElements(whereClause);
    }
    var orderClause = parseSection(query, 'order\\s+by');
    var orders = null;
    if (orderClause) {
        orders = getOrderByElements(orderClause);
    }

    var metadata = {
        farm: farm,
        Label: label,
        IdProperty: idProperty,
        Get: [{
            Columns: selects,
            Joins: joins
        }]
    };
    if (conditions != null) {
        Object.assign(metadata.Get[0], conditions);
    }
    if (orders) {
        metadata.Order = orders;
    }

    return metadata;
}

function parseSection(string, startSeparator, endSeparator) {
    //const result = new Parser(endSeparator, string).nextOcurrence(0);
    var resStart = new Parser(startSeparator, string).nextOcurrence(0);
    if (resStart == null) {
        return '';
    }
    var start = resStart.index + resStart.match.length;
    var end = string.length + 1;
    if (endSeparator) {
        var result = new Parser(endSeparator, string).nextOcurrence(0);
        if (result != null) {
            end = result.index;
        }
    }
    var section = string.slice(start, end);
    console.log(section);
    return section;
}

function sanizateQuery(query) {
    return query.replace(/\s+/ig, ' ');
}

function getJson(query) {
    return JSON.stringify(parseQuery(query));
}
