module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    browserify: {
      production: {
        src: ['src/index.js'],
        dest: 'cc-wallet-core.js',
        options: {
          browserifyOptions: {
            standalone: 'ccWallet'
          }
        }
      },
      test: {
        src: ['test/*.js'],
        dest: 'cc-wallet-core.test.js'
      }
    },
    clean: {
      builds: {
        src: ['cc-wallet-core.js', 'cc-wallet-core.min.js', 'cc-wallet-core.test.js']
      }
    },
    jshint: {
      src: ['Gruntfile.js', 'src', 'test'],
      options: {
        jshintrc: true,
        reporter: require('jshint-stylish')
      }
    },
    jscs: {
      src: ['Gruntfile.js', 'src', 'test'],
      options: {
        config: '.jscsrc'
      }
    },
    mocha_istanbul: {
      coverage: {
        src: 'test',
        options: {
          mask: '*.js',
          reporter: 'spec',
          timeout: 120000
        }
      },
      coveralls: {
        src: 'test',
        options: {
          coverage: true,
          mask: '*.js',
          reporter: 'spec',
          timeout: 120000
        }
      }
    },
    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          timeout: 120000
        },
        src: ['test/*.js']
      }
    },
    uglify: {
      production: {
        files: {
          'cc-wallet-core.min.js': 'cc-wallet-core.js'
        }
      }
    },
    watch: {
      configFiles: {
        files: ['Gruntfile.js'],
        options: {
          reload: true
        }
      },
      src: {
        files: ['src/**.js', 'test/*.js'],
        tasks: ['jshint', 'coverage']
      }
    }
  })

  grunt.event.on('coverage', function (lcov, done) {
    require('coveralls').handleInput(lcov, function (error) {
      if (error && !(error instanceof Error)) {
        error = new Error(error)
      }

      done(error)
    })
  })

  grunt.loadNpmTasks('grunt-browserify')
  grunt.loadNpmTasks('grunt-contrib-clean')
  grunt.loadNpmTasks('grunt-contrib-jshint')
  grunt.loadNpmTasks('grunt-contrib-uglify')
  grunt.loadNpmTasks('grunt-contrib-watch')
  grunt.loadNpmTasks('grunt-mocha-istanbul')
  grunt.loadNpmTasks('grunt-jscs')
  grunt.loadNpmTasks('grunt-mocha-test')

  grunt.registerTask('compile', ['browserify:production', 'uglify:production'])
  grunt.registerTask('compile_test', ['browserify:test'])
  grunt.registerTask('coverage', ['mocha_istanbul:coverage'])
  grunt.registerTask('coveralls', ['mocha_istanbul:coveralls'])
  grunt.registerTask('test', ['mochaTest'])
}
