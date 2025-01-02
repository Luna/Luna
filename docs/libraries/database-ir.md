---
layout: developer-doc
title: Database IR
category: libraries
tags: [libraries, databases, integrations]
order: 4
---

# Overview

Represents a query, is compiled into SQL.
Not used by end users, but rather behind the scenes to implement the relational calculus that implements the table operations.

A query is a t and some cs.

a query is: table and column values
table values: db tables, subqueries, joins and unions, literal table expressions

# User-facing Types

DB_Table
DB_Column
Row (less common)

not part of the IR, but use it internally

# Main IR Types

Top-level queries and DDL/DML commands are represented by the `Query` type.

Table expressions are represented by the mutually-recursive types `From_Spec` and `Context`.

Column expressions are represented by `SQL_Expression`. `SQL_Expression` values only have meaning within the context of a table expression.

## SQL_Expression

Represents a column expression. Can be a single column (`Column`), a derived expression built from other expressions (`Operation`), or a constant value (`Constant`, `Literal`, `Text_Literal`).

`SQL_Expression`s only have meaning in the context of a particular table value; for example, a `Column` expression consists of the name/alias of a table value and the name of a column within that value.

This also includes `Let` and `Let_Ref` variants which are used to express let-style bindings using SQL `WITH` syntax.

## From_Spec

Represents a table expression. Can be a database table (`Table`), a derived table built from other tables (`Join`, `Union`)), or a constant value (`Query`, `Literal_Values`).

`Sub_Query` is used to nest a query as a sub-query, replacing column expressions with aliases to those same column expressions within the sub-query. This is used to keep query elements such as `WHERE`, `ORDER BY`, and `GROUP BY` in separate layers to prevent unwanted interactions between them. `Sub_Query` values are not generally created directly by end users, but rather create as a step in Enso table operations such as `join`.

## Context

Represents a table expression, along with `WHERE`, `ORDER BY`, `GROUP BY` and `LIMIT` clauses.

## Query

A table expression (`Select`), or a DML or DDL command (`Insert`, `Create_Table`, `Drop_Table `, and others).

# Relationships Between The Main Types

This section covers the main ways in which both the IR and user-facing types are combined and nested to describe typical queries; it is not comprehensive.

A `DB_Table` serves as a user-facing table value, and contains column expressions as `Internal_Column`s and a table expression as a `Context`.

A `DB_Column` serves as a user-facing column value, and contains a column expression as an `SQL_Expression` and a table expression as a `Context`.

An `Internal_Column` serves as a column value, and contains a `SQL_Expression`, but no table expression. An `Internal_Column` is always used inside a `DB_Table`, and inherits its table expression from the `DB_Table`'s `Context`.

A `Context` serves as a table value, but really inherits this from the `From_Spec` that it contains. It also contains `WHERE`, `ORDER BY`, `GROUP BY` and `LIMIT` clauses.

A `From_Spec` serves as a table value, and can be a base value (table name, constant, etc). It can also be a `Sub_Query`, in which case it contains column values as `SQL_Expression`s, and a table value as a `Context`.

# Subqueries

Subqueries are created using `Context.as_subquery`. They correspond to (and are compiled into) nested `SELECT` expressions. This allows them to be referred to by an alias, and also nests certian clauses (`WHERE`, `ORDER BY`, `GROUP BY` and `LIMIT`) in a kind of 'scope' within the sub-select so that they will not interfere with other such clauses.

By itself, turning a query into a sub-query does not change its value. But it prepares it to be used in larger queries, such as ones formed with `JOIN` and `UNION`, as well as other more specific operations within the database library (such as `DB_Table.add_row_number`). 

In the IR, `Context.as_subquery` prepares a table-value expression for nesting, but does not do the actual nesting within another query. To do the actual nesting, you use the prepared subquery as a table expression within a larger query.

This preparation consists of replacing complex column expressions with aliases that refer to the original complex expressions within the nested query. For example, a query such as

```sql
select [complex column expression 1], [complex column expression 2]
from [complex table expression]
where [where clauses]
group by [group-by clauses]
order by [order-by clauses]
```

would be transformed into

```sql
select alias1, alias2
from (select [complex column expression 1] as alias1, [complex column expression 2] as alias2
      from [complex table expression]
      where [where clauses]
      group by [group-by clauses]
      order by [order-by clauses]) as [table alias]
```

After this transformation, the top-level query has no `WHERE`, `GROUP BY`, or `ORDER BY` clauses. These can now be added:

```sql
select alias1, alias2
from (select [complex column expression 1] as alias1, [complex column expression 2] as alias2
      from [complex table expression]
      where [where clauses]
      group by [group-by clauses]
      order by [order-by clauses]) as [table alias]
where [more where clauses]
group by [more group-by clauses]
order by [more order-by clauses])
```

Thanks to this nesting, there can be no unwanted interference between the `WHERE`, `GROUP BY`, or `ORDER BY` at different levels.

The added table alias allows join conditions to refer to the columns of the individual tables being joined.

The `Context.as_subquery` method returns a `Sub_Query_Setup`, which contains a table value as a `From_Spec`, a set of simple column expressions as `Internal_Column`s, and a helper function that can convert an original complex `Internal_Column` into its simplified alias form.

extensions
columns in one query must share contexts
Internal_Column vs DB_Column
traverse
additional types not in IR: SQL_Statement, SQL_Fragment, SQL_Builder, SQL_Query, Internal_Column