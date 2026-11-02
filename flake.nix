{
  description = "Community-maintained per-site CSS selectors for keyboard link hints";

  inputs = {
    flake-parts = {
      inputs.nixpkgs-lib.follows = "nixpkgs";
      url = "github:hercules-ci/flake-parts";
    };

    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    pedantix = {
      inputs = {
        flake-parts.follows = "flake-parts";
        nixpkgs.follows = "nixpkgs";
        treefmt-nix.follows = "treefmt-nix";
      };
      url = "github:Swarsel/pedantix";
    };

    systems.url = "github:nix-systems/default";

    treefmt-nix = {
      inputs.nixpkgs.follows = "nixpkgs";
      url = "github:numtide/treefmt-nix";
    };
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        inputs.treefmt-nix.flakeModule
        inputs.pedantix.flakeModules.default
      ];
      perSystem =
        {
          config,
          lib,
          pkgs,
          ...
        }:
        {
          checks.hint-selectors = config.packages.hint-selectors;
          devShells.default = pkgs.mkShell {
            packages = [
              config.treefmt.build.wrapper
              pkgs.nodejs_24
            ];
          };
          packages = {
            default = config.packages.hint-selectors;
            glide-integration = pkgs.runCommand "hint-selectors.glide.ts" { } ''
              cp ${config.packages.hint-selectors}/hint-selectors.glide.ts $out
            '';
            hint-selectors = pkgs.buildNpmPackage {
              checkPhase = ''
                runHook preCheck
                npm run check
                npm test
                runHook postCheck
              '';
              doCheck = true;
              installPhase = ''
                runHook preInstall
                cp -r dist $out
                runHook postInstall
              '';
              nodejs = pkgs.nodejs_24;
              npmBuildScript = "build";
              npmDepsHash = "sha256-9sq73q+tMheFawZtgSNzj5RqPHRevtC/Wl6Jcj5JTaQ=";
              pname = "hint-selectors";
              src = lib.fileset.toSource {
                fileset = lib.fileset.unions [
                  ./integrations
                  ./package-lock.json
                  ./package.json
                  ./schema
                  ./scripts
                  ./sites
                  ./src
                  ./test
                ];
                root = ./.;
              };
              version = (lib.importJSON ./package.json).version;
            };
          };
          treefmt = {
            programs = {
              pedantix.enable = true;
              prettier.enable = true;
            };
            projectRootFile = "flake.nix";
          };
        };
      systems = import inputs.systems;
    };
}
