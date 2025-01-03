---
layout: developer-doc
title: Database IR
category: libraries
tags: [libraries, databases, integrations]
order: 4
---

# Overview

The database internal representation (IR) is used to describe full SQL queries and statements in a backend-neutral way. The IR is compiled to SQL in `Base_Generator`, with backend-specific variations supplied by the `Dialect` modules.

End-users do not use IR types directly; they interact wih the `DB_Table` and `DB_Column` types, which are analagous to the in-memory `Table` and `Column` types. User-facing operations on these types do not immediately execute SQL in the database backends; they only create IR. As a final step, the IR is compiled into SQL and sent to the backend.

Informally, a "query" consists of a table expression and a set of column expressions, roughly corresponding to:

```sql
select [column expression], [column expression]
from [table expression]
```

This terminology applies to both the user-facing and IR types, which represent table and column expression in multiple ways.

# Main IR Types

Column expressions are represented by `SQL_Expression`. `SQL_Expression` values only have meaning within the context of a table expression; they do not contain their own table expressions.

Table expressions are represented by the mutually-recursive types `From_Spec` and `Context`.

Top-level queries and DDL/DML commands are represented by the `Query` type.

## SQL_Expression

Represents a column expression. Can be a single column (`Column`), a derived expression built from other expressions (`Operation`), or a constant value (`Constant`, `Literal`, `Text_Literal`).

`SQL_Expression`s only have meaning in the context of a particular table expression; for example, a `SQL_Expression.Column` value consists of the name/alias of a table expression and the name of a column within it.

This also includes `Let` and `Let_Ref` variants which are used to express let-style bindings using SQL `WITH` syntax.

## From_Spec

Represents a table expression. Can be a database table (`Table`), a derived table built from other tables (`Join`, `Union`), or a constant value (`Query`, `Literal_Values`).

`Sub_Query` is used to nest a query as a subquery, replacing column expressions with aliases to those same column expressions within the subquery. This is used to keep query elements such as `WHERE`, `ORDER BY`, and `GROUP BY` separate to prevent unwanted interactions between them. This allows `join` and `union` operations on complex queries, as well as more specific operations such as `add_row_number`.

## Context

Represents a table expression, along with `WHERE`, `ORDER BY`, `GROUP BY` and `LIMIT` clauses.

A `DB_Column` contains its own reference to a `Context`, so it can be read without relying on the `DB_Table` object that it came from. In fact, `DB_Column` values can be thought of as not being attached to a particular table. Instead, they are connected to the `Context` objects they contain, and all `DB_Columns` from a single table expression must share the same `Context`. This corresponds to the idea that the columns expressions in a `SELECT` clause all refer to the same table expression in the `FROM` clause.

## Query

A query (`Select`), or other DML or DDL command (`Insert`, `Create_Table`, `Drop_Table `, and others).

# Relationships Between The Main Types

This section covers the main ways in which both the IR and user-facing types are combined and nested to describe typical queries; it is not comprehensive.

A `DB_Table` serves as a user-facing table expression, and contains column expressions as `Internal_Column`s and a table expression as a `Context`.

A `DB_Column` serves as a user-facing column expression, and contains a column expression as an `SQL_Expression` and a table expression as a `Context`.

An `Internal_Column` serves as a column expression, and contains a `SQL_Expression`, but no table expression. An `Internal_Column` is always used inside a `DB_Table`, and inherits its table expression from the `DB_Table`'s `Context`.

A `Context` serves as a table expression, but really inherits this from the `From_Spec` that it contains. It also contains `WHERE`, `ORDER BY`, `GROUP BY` and `LIMIT` clauses.

A `From_Spec` serves as a table expression, and can be a base value (table name, constant, etc), join, union, or subquery.
- `From_Spec.Join`: contains `From_Spec` values from the individual tables, as well as `SQL_Expressions` for join conditions
- `From_Spec.Union`: contains a vector of `Query` values for the individual tables.
- `From_Spec.Sub_Query`: contains column expressions as `SQL_Expression`s, and a table expression as a `Context`.

# Subqueries

Subqueries are created using `Context.as_subquery`. They correspond to (and are compiled into) nested `SELECT` expressions. This allows them to be referred to by an alias, and also nests certian clauses (`WHERE`, `ORDER BY`, `GROUP BY` and `LIMIT`) in a kind of 'scope' within the sub-select so that they will not interfere with other such clauses.

By itself, turning a query into a subquery does not change its value. But it prepares it to be used in larger queries, such as ones formed with `JOIN` and `UNION`, as well as other more specific operations within the database library (such as `DB_Table.add_row_number`). 

In the IR, `Context.as_subquery` prepares a table expression for nesting, but does not do the actual nesting within another query. To do the actual nesting, you use the prepared subquery as a table expression within a larger query.

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

The `Context.as_subquery` method returns a `Sub_Query_Setup`, which contains a table expression as a `From_Spec`, a set of simple column expressions as `Internal_Column`s, and a helper function that can convert an original complex `Internal_Column` into its simplified alias form.

# Context Extensions

TODO

# Additional Types

- SQL_Statement
- SQL_Fragment
- SQL_Builder
- SQL_Query

TODO