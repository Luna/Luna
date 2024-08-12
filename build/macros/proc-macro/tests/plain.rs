use itertools::Itertools;
use std::ffi::OsStr;
use std::ffi::OsString;
use std::str::FromStr;


#[derive(Clone, Copy, Debug, enso_build_macros::Arg)]
pub enum Foo {
    Foo,
    BarBaz,
}

#[test]
fn hello() {
    let foo = Foo::Foo;
    assert_eq!(foo.as_ref(), OsStr::new("--foo"));
    let args = foo.into_iter().collect_vec();
    assert_eq!(args, vec![OsString::from("--foo")]);

    let bar_baz = Foo::BarBaz;
    assert_eq!(bar_baz.as_ref(), OsStr::new("--bar-baz"));
    let args = bar_baz.into_iter().collect_vec();
    assert_eq!(args, vec![OsString::from("--bar-baz")]);
}

#[test]
fn experiment_with_parsing() {
    let code = "foo = ToString::to_string";
    let token_stream = proc_macro2::TokenStream::from_str(code).unwrap();
    dbg!(&token_stream);
    let foo = syn::parse2::<syn::ExprAssign>(token_stream).unwrap();
    dbg!(&foo);
}
