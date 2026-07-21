CREATE INDEX "calendario_por_reserva" ON "calendario_dias" USING btree ("reserva_id");--> statement-breakpoint
CREATE INDEX "fugas_por_usuario" ON "intentos_fuga" USING btree ("usuario_id","accion");--> statement-breakpoint
CREATE INDEX "chat_por_solicitud" ON "mensajes_chat" USING btree ("solicitud_id");--> statement-breakpoint
CREATE INDEX "reservas_por_propiedad" ON "reservas" USING btree ("propiedad_id","estado");--> statement-breakpoint
CREATE INDEX "reservas_por_principal" ON "reservas" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "reservas_por_externo" ON "reservas" USING btree ("externo_id");--> statement-breakpoint
CREATE INDEX "solicitudes_por_propiedad" ON "solicitudes" USING btree ("propiedad_id","estado");--> statement-breakpoint
CREATE INDEX "solicitudes_por_externo" ON "solicitudes" USING btree ("externo_id");--> statement-breakpoint
CREATE INDEX "splits_por_beneficiario" ON "splits" USING btree ("beneficiario_id","concepto");--> statement-breakpoint
CREATE INDEX "splits_por_transaccion" ON "splits" USING btree ("transaccion_id");--> statement-breakpoint
CREATE INDEX "tarifas_por_propiedad" ON "tarifas" USING btree ("propiedad_id");--> statement-breakpoint
CREATE INDEX "transacciones_por_link" ON "transacciones" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "vinculos_por_principal" ON "vinculos_comisionista" USING btree ("principal_id","estado");