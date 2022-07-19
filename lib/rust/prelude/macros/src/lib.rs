
// === Standard Linter Configuration ===
#![deny(non_ascii_idents)]
#![warn(unsafe_code)]
// === Non-Standard Linter Configuration ===
#![allow(clippy::option_map_unit_fn)]
#![allow(clippy::precedence)]
#![allow(dead_code)]
#![deny(unconditional_recursion)]
#![warn(missing_copy_implementations)]
#![warn(missing_debug_implementations)]
#![warn(missing_docs)]
#![warn(trivial_casts)]
#![warn(trivial_numeric_casts)]
#![warn(unused_import_braces)]
#![warn(unused_qualifications)]

use inflector::cases::snakecase::to_snake_case;
use proc_macro2::TokenStream;
use quote::quote;
use syn::punctuated::Punctuated;
use syn::Token;



#[proc_macro_derive(ForEachVariant)]
pub fn derive_for_each_variant(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let decl = syn::parse_macro_input!(input as syn::DeriveInput);
    let ret = match decl.data {
        syn::Data::Enum(ref e) => derive_for_enum(&decl, e),
        _ => panic!("The `ForEachVariant` derive macro only works on enums."),
    };
    proc_macro::TokenStream::from(ret)
}

fn derive_for_enum(decl: &syn::DeriveInput, data: &syn::DataEnum) -> TokenStream {
    let enum_name = &decl.ident;
    let enum_snake_name = to_snake_case(&enum_name.to_string());
    let macro_name = quote::format_ident!("for_each_{}_variant", enum_snake_name);
    let variant_names: Punctuated<_, Token![,]> = data.variants.iter().map(|v| &v.ident).collect();
    quote! {
        #[macro_export]
        macro_rules! #macro_name {
            ($f:ident($($args:tt)*)) => { $f!([ #variant_names ] $($args)*) }
        }

        pub(crate) use #macro_name;
    }
}

