.PHONY: build

build:
	tsc -b tsconfig.json
	tsc -p tsconfig.cjs.json
	echo '{"type": "commonjs"}' > dist/cjs/package.json
	echo '{"type": "module"}' > dist/esm/package.json
	./bundle.mjs
	chmod +x dist/bin/*.js
	cp bin/*.py dist/bin
