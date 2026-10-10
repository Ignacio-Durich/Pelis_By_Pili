-- Como las demás tablas: en producción las tablas nuevas no le dan permisos a service_role solas,
-- y sin esto los tests (y un pedido con la clave de servicio) no pueden leer los comentarios.
grant all on public.feedback to service_role;
