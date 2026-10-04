describe('actual browser tools',()=>{
 it('formats a JSON value and leaves embedded HTML as inert output',()=>{
  cy.visit('/functions/json/');
  cy.get('textarea[name=source]').clear().type('{"n":3,"s":"<script>window.bad=1</script>"}',{parseSpecialCharSequences:false});
  cy.get('#tool-run').click();
  cy.get('#tool-output').invoke('val').should(value=>{expect(JSON.parse(value)).to.deep.equal({n:3,s:'<script>window.bad=1</script>'});});
  cy.window().its('bad').should('be.undefined');
  cy.get('[aria-label="退出工具返回主页"]').should('be.visible');
 });
 it('opens the tool directory through the real fixed exit',()=>{
  cy.visit('/functions/base64/');cy.get('.maze-index').click();cy.url().should('include','/functions/');cy.get('.tool-directory').should('be.visible');
 });
});
