/* global cy */

describe('Pokedex', function() {
  it('frontpage can be opened', function () {
    cy.visit('http://localhost:5000')
    cy.contains('pikachu')
    cy.contains('Pokémon and Pokémon character names are trademarks of Nintendo')
  })
})

// Lo que hace Cypress al correr esto:

// Abre un navegador de verdad (Chrome, en modo automatizado, sin que lo veas en el pipeline de CI)
// cy.visit('http://localhost:5000') → navega a esa URL, como si escribieras la dirección vos mismo
// cy.contains('pikachu') → busca en la pantalla renderizada si aparece el texto "pikachu" en algún lado
// Si no aparece (por ejemplo, si la API de pokémon no respondió, o si un cambio de código rompió el listado), el test falla