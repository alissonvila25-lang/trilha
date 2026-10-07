/* Perguntas da anamnese, usadas no painel (Formulação) e na página que a paciente preenche pelo link
   (anamnese.html). [chave, pergunta, tipo] — tipo vazio = texto longo. Mudar uma chave aqui desliga a
   resposta já salva com a chave antiga. */
window.TRILHA_ANAMNESE=[
  ["Identificação",[["email","E-mail","email"],["nome","Nome completo","short"],["nascimento","Data de nascimento","date"],["cpf","CPF","short"],
    ["escolaridade","Grau de escolaridade","short"],["profissao","Profissão","short"],["religiao","Religião","short"],["pronome","Qual pronome você prefere que eu use para me referir a você?","short"],
    ["orientacao","Orientação sexual","short"],["genero","Identidade de gênero","short"],
    ["endereco","Endereço completo (rua, número, bairro, cidade, estado, CEP)"],["reside","Com quem você reside"],
    ["contato1","Contato de segurança nº 1 (nome, grau de parentesco e telefone)"],["contato2","Contato de segurança nº 2 (nome, grau de parentesco e telefone)"]]],
  ["Saúde",[["psiquiatrico","Faz tratamento psiquiátrico? Se sim, há quanto tempo?"],["condicao","Você tem alguma condição médica atual ou houve alguma mudança na sua saúde geral neste último ano?"],
    ["familiar","Algum familiar próximo (pais, irmãos ou avós) possui ou já possuiu diagnóstico de transtorno mental ou faz/fazia acompanhamento psicológico ou psiquiátrico?"],
    ["medicacao","Faz uso de medicação?"],["psicoterapia","Você já fez psicoterapia antes?"],
    ["autolesao","Você apresentou ou já apresentou comportamentos autolesivos? Se sim, quais? Quando? (cortes, arranhões, queimaduras, beliscar…)"]]],
  ["Motivos e objetivos",[["motivos","Descreva os motivos que o levaram a buscar atendimento psicológico"],["objetivos","Descreva os objetivos que você gostaria de alcançar com a terapia"],
    ["assinale","Assinale qualquer dos seguintes itens que se aplique a você"]]],
  ["Rotina e relações",[["tempo","Como você ocupa a maior parte do seu tempo?"],["alimentacao","Como anda a sua alimentação?"],["sono","Como anda seu sono?"],
    ["atividade","Você pratica alguma atividade física?"],["sexual","A sua vida sexual atual é satisfatória?"],["sexo_info","Quando e como você conseguiu suas primeiras informações sobre sexo?"],
    ["familia","Como você descreveria sua relação familiar?"]]],
  ["Futuro",[["futuro","Você poderia contar alguma coisa sobre seus planos, esperanças e expectativas para o futuro?"],
    ["outros","Tem algo que não foi abordado neste questionário, que você ache importante me contar?"]]]
];
