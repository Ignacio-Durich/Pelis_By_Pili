-- La nota de origen de Descubrir pasa de "De Descubrir" a "Descubrir": la ficha ya dice "De dónde vino:".
update public.titles set origin_note = 'Descubrir' where origin_note = 'De Descubrir';
