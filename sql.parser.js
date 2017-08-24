
class Parser {
    constructor(separator, string) {
        this.separator = separator;
        this.string = string;
        this.parentesis = '(';
        this.ocurrence = new RegExp(`(${separator})|(\\()`, 'i');
    }

    nextOcurrence(start) {
        const res = this.ocurrence.exec(this.string.slice(start));
        const lookIn = this.string.slice(start);
        console.log(lookIn);
        if (!res) {
            return null;
        }
        console.log(start);
        console.log(res[0]);
        const result = res[0];
        if (result === this.parentesis) {
            return this.nextOcurrence(this.getPar(this.string, start + this.string.slice(start).indexOf(result) + 1));
        } else if (result.match(new RegExp(this.separator, 'i'))) {
            const startOfMatch = start + this.string.slice(start).indexOf(result);
            console.log(startOfMatch);
            console.log(result);
            //const endOfMatch = start + startOfMatch + result.length;

            return { index: startOfMatch, match: result };
        } else {
            return null;
        }

        //if(result.ma)
    }

    getPar(string, start) {
        const res = /(\(|\))/g.exec(string.slice(start));
        const lookIn = string.slice(start);
        console.log()
        console.log(res);
        if (res[0] === '(') {
            return this.getPar(string, this.getPar(string, start + res.index + 1));
        } else if (res[0] === ')') {
            return start + res.index + 1;
        }
    }

    getSection(startIndex, firstSection) {
        let startMatchSearch = startIndex;
        if (!firstSection) {
            const resFirstMatch = this.nextOcurrence(startIndex);
            console.log('res first match', resFirstMatch);
            if (resFirstMatch == null) {
                return null;
            }
            startMatchSearch = resFirstMatch.index + resFirstMatch.match.length;
        }
        const matchSearch = this.nextOcurrence(startMatchSearch);
        let section = null;
        if (matchSearch == null) {
            section = this.string.slice(startIndex);
        } else {
            section = this.string.slice(startIndex, matchSearch.index);
        }

        return section;
    }

    getSections() {
        let section = this.getSection(0, true);
        const sections = [];
        let cursor = 0;
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
}


function getSelectElements(section) {
    const separator = ',';
    const parser = new Parser(separator, section);
    let sections = parser.getSections();
    sections = sections.map(eliminateComma);
    return sections;
}

function getFromElements(section) {
    const separator = '(left|right|inner|full|cross)?(\\s+outer)?\\s+join';
    const parser = new Parser(separator, section);
    let sections = parser.getSections();
    if (sections[0]) {
        sections[0] = convertFromClause(sections[0])
    }
    return sections;
}

function getWhereElements(section) {
    if (/(@\w+)/ig.exec(section) == null) {
        return {
            PreCondition: section
        };
    }
    const separator = '\\s+and\\s+|\\s+or\\s+';
    const parser = new Parser(separator, section);
    let sections = parser.getSections();
    sections = sections.reduce(convertCondition, {});
    return sections;
}

function convertCondition(value, condition, index, conditions) {
    const res = /(@\w+)/ig.exec(condition);
    if (res != null) {
        const parameter = res[0].slice(1);
        const resOperator = new Parser('^(and)\\s+|^(or)\\s+', condition).nextOcurrence(0);
        let operator = ' and ';
        let valueCondition = condition;
        if (resOperator != null) {
            operator = ' ' + resOperator.match;
            valueCondition = condition.slice(resOperator.index + resOperator.match.length);
        }
        const conditionObject = {
            parameter,
            value: valueCondition,
            Operator: operator
        }
        if (/(\/\*.*opt.*\*\/)/ig.exec(condition) != null) {
            if (value.OptionalConditions != null) {
                value.OptionalConditions.push(conditionObject)
            } else {
                value.OptionalConditions = [conditionObject]
            }

        } else {
            if (value.RequiredConditions != null) {
                value.RequiredConditions.push(conditionObject)
            } else {
                value.RequiredConditions = [conditionObject]
            }
        }
        return value;

    } else {
        if (value.PreCondition != null) {
            value.PreCondition += " " + condition;
        } else {
            const resOperator = new Parser('^(and)\\s+|^(or)\\s+', condition).nextOcurrence(0);
            if(resOperator == null){
                value.PreCondition = condition;
            }else{
                value.PreCondition = condition.slice(resOperator.index + resOperator.match.length);
            }
            
        }
        return value;
    }

}

function convertFromClause(join) {
    const res = new Parser('\\s+with\\s*\\(nolock\\)', join).nextOcurrence(0);
    if (res) {
        return join.slice(0, res.index);
    } else {
        return join;
    }
}

function getOrderByElements(section) {
    const separator = ',';
    const parser = new Parser(separator, section);
    let sections = parser.getSections();
    sections = sections.map(eliminateComma);
    return sections;
}

function eliminateComma(section, index) {
    if (index == 0) {
        return section;
    }
    else {
        return section.slice(1).trim();
    }
}

function parseQuery(query, farm, label, idProperty) {
    query = sanizateQuery(query);
    const selectClause = parseSection(query, 'select', 'from');
    const selects = getSelectElements(selectClause);
    const fromClause = parseSection(query, 'from', 'where|order\\s+by');
    const joins = getFromElements(fromClause);
    const whereClause = parseSection(query, 'where', 'order\\s+by');
    let conditions = null;
    if (whereClause) {
        conditions = getWhereElements(whereClause);
    }
    const orderClause = parseSection(query, 'order\\s+by')
    let orders = null;
    if (orderClause) {
        orders = getOrderByElements(orderClause);
    }

    const metadata = {
        farm,
        Label: label,
        IdProperty: idProperty,
        Get: [{
            Columns: selects,
            Joins: joins,
        }]
    }
    if (conditions != null) {
        Object.assign(metadata.Get[0], conditions);
    }
    if(orders){
        metadata.Order = orders;
    }

    return metadata;

}

function parseSection(string, startSeparator, endSeparator) {
    //const result = new Parser(endSeparator, string).nextOcurrence(0);
    const resStart = new Parser(startSeparator, string).nextOcurrence(0);
    if (resStart == null) {
        return '';
    }
    const start = resStart.index + resStart.match.length;
    let end = string.length + 1;
    if (endSeparator) {
        const result = new Parser(endSeparator, string).nextOcurrence(0);
        if (result != null) {
            end = result.index;
        }
    }
    const section = string.slice(start, end);
    console.log(section);
    return section;
}

function sanizateQuery(query) {
    return query.replace(/\s+/ig, ' ');
}

function getJson(query){
    return JSON.stringify(parseQuery(query));
}
