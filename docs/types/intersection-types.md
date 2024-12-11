---
layout: developer-doc
title: The Enso Type Hierarchy
category: types
tags: [types, hierarchy, typeset]
order: 2
---

# Intersection Types

Intersection types play an important role in Enso [type hierarchy](./hierarchy.md)
and its visual representation. Having a value that can play _multiple roles_
at once is essential for smooth _live programming_ manipulation of such a value.

Intersections types are created with the use of [`&` operator](./hierarchy.md#typeset-operators).
In an attempt to represent `Complex` numbers (with real and imaginary component)
one may decide to create a type that is both `Complex` and `Float` when the
imaginary part is `0`:
```ruby
type Complex
    Num re:Float im:Float
    
    plain_or_both self = 
        if self.im != 0 then self else
            both = self.re : Complex&Float
            both # value with both types: Complex and Float
```   
Having a value with such _intersection type_ allows the IDE to offer operations
available on all individual types.

## Creating

Creating a value of _intersection types_ is as simple as performing a type check:
```ruby
self : Complex&Float
```
However such a _type check_ is closely associated with [conversions](../syntax/conversions.md).
If the value doesn't represent all the desired types yet, then the system looks 
for [conversion methods](../syntax/conversions.md) being available in the scope like:
```
Complex.from (that:Float) = Complex.Num that 0
```
and uses them to create all the values the _intersection type_ represents.

## Narrowing Type Check

When an _intersection type_ value is being downcast to _one of the types it already represents_,
such a check is:
- recorded for purposes of [dynamic dispatch](../types/dynamic-dispatch.md)
- recorded for cases when the value is passed as an argument
- however the value still keeps (internal) knowledge of all the types it represents

As such a _static analysis_ knows the type a value _has been cast to_ and 
can deduce the set of operations that can be performed with it. However, the value
_can be cast to_ explicitly.

> [!NOTE]
> In the **object oriented terminology** we can think of
> a type `Complex&Float` as being a subclass of `Complex` and subclass of `Float` types.
> As such a value of type `Complex&Float` may be used wherever `Complex` or `Float` types
> are used. Let there, for example, be a function:
> ```ruby
> use_complex c:Complex callback:(Any -> Any) = callback c
> ```
> that accepts `Complex` value and passes it back to a provided callback function.
> It is possible to pass a value of `Complex&Float` type to such a function. Only
> operations available on type `Complex` can be performed on value in variable `c`.
>
> However the `callback` function may still explicitly cast the value to `Float`.
> E.g. the following is valid:
> ```ruby
> both = v : Complex&Float
> use_complex both (v-> v:Float . sqrt)
> ```
> This behavior is often described as being **openness to subclasses**. E.g. the `c:Complex` 
> check allows values with _intersection types_ that include `Complex` to pass thru with
> all their runtime information available,
> but one has to perform an explicit cast to extract the other types associated with 
> such a value.

This behavior allows creation of values with types like `Table&Column` to represent a table
with a single column - something the users of visual _live programming_ environment of Enso find
very useful.
```ruby
Table.join self right:Table -> Table = ...
```
Such a `Table&Column` value can be returned from the above `Table.join` function and while
having only `Table` behavior by default, still being able to be explicitly casted by the visual environment
to `Column`. 
