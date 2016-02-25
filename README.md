# Luna programming language
### Visual and textual functional programming language with a focus on productivity, collaboration and development ergonomics.

Luna is a developer’s whiteboard on steroids. Design, prototype, develop and refactor any application simply by connecting visual elements together. Collaborate with co-workers, interactively fine tune parameters, inspect the results and visually profile the performance in real-time.

Visit www.luna-lang.org to learn more!

## Getting Started

These instructions give the most direct path to a working Luna
development environment. 

### System Requirements

OS X, Ubuntu Linux LTS, and the latest Ubuntu Linux release are the current
supported host development operating systems.

For OS X, you need [the latest Xcode](https://developer.apple.com/xcode/downloads/) and the following dependencies:

    brew install git python3 pkg-config ghc cabal-install

For Ubuntu, you'll need the following development dependencies:

    sudo apt-get install git python3 haskell-platform


### Getting Sources for Luna compiler and its ecosystem tools

**Via HTTPS**  For those checking out sources as read-only, HTTPS works best:

    git clone https://github.com/wdanilo/luna.git
    git clone https://github.com/wdanilo/workflow.git


**Via SSH**  For those who plan on regularly making direct commits,
cloning over SSH may provide a better experience (which requires
uploading SSH keys to GitHub):

    git clone git@github.com:wdanilo/luna.git
    git clone git@github.com:wdanilo/workflow.git

### Building Luna

The `workflow/build` script is a high-level build wrapper for every project from Luna's ecosystem. To learn about the supported options, use the `help` one:

    workflow/build --help

Note: Arguments after `--` above are passed directly to Haskell's build system [Stack](http://haskellstack.org).

To fast start the development use the following command:

    workflow/build luna/compiler

If you want to use the newest available libraries that Luna depends on, you can use the newest available versions on GitHub instead of Hackage. It is usefull if you are developing the libraries as well and don't want to wait until Hackage propagates information about new library versions:

    workflow/build --nightly luna/compiler

You can also setup fully-flagged local development workspace and use local directories to override the sources of needed libraries. You will need a `libs` directory next to `workflow` and `luna` and use the `--develop` option:

    workflow/build --develop luna/compiler

If you want to release a final Luna compiler version, you can enable the highest possible optimizations and disable some tricks used for compilation fastening using the `--release` flag instead.
