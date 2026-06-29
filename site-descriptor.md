## field

viene aperto su uno dei campi tramite l'id.
imposta un link per tornare alla pagina con tutti i campi e crea lo scheletro per visualizzare i dettagli di un campo.

il JS crea dei connettori ai vari elementi del HTML. today da la data attuale

la prima cosa che viene fatta è aggiungere degli eventilistener al blocco contenente la data e al blocco per registrare le nuove prenotazioni

## partite

la pagina mostra tutte le partite in corso e offre la possibilità di aggiungerne di nuove la partita deve essere legata a un torneo, ma posso modificare il momento in cui viene fatta, legarla a una prenotazione di un campo, modificarne il risultato.




se la partita è già stata giocata lascio la prenotazione e via

se voglio inserire il risultato devo controllare che la partita sia stata prenotata

se la partita non è ancora stata giocata posso prenotarla:
se non sono l'owner non posso fare nulla e vedo soltanto "da definire" oppure la prenotazione
se sono l'owner vedo un menù a tendina con le mie prenotazioni in linea con lo sport. tra le opzioni c'è anche da definire