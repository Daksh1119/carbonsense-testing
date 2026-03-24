-- Seed TEME species catalog into tree_species.

insert into public.tree_species (
	name,
	region,
	maturity_years,
	peak_sequestration_kg,
	annual_survival_rate,
	land_per_tree_hectare,
	growth_rate_class,
	drought_score,
	fire_score,
	disease_score
)
values
	('Neem', 'India,India_tropical,India_arid,India_subtropical,India_semi_arid', 6, 25.0, 0.95, 0.01, 7, 8, 7, 8),
	('Peepal', 'India,India_tropical,India_subtropical,India_semi_arid', 8, 30.0, 0.93, 0.015, 5, 6, 5, 6),
	('Bamboo', 'India,India_tropical,India_subtropical,India_coastal,India_northeastern', 3, 20.0, 0.90, 0.008, 9, 5, 6, 7),
	('Teak', 'India,India_tropical,India_coastal,India_northeastern', 10, 22.0, 0.93, 0.012, 4, 5, 6, 7),
	('Mango', 'India,India_tropical,India_subtropical,India_coastal,India_semi_arid', 7, 18.0, 0.94, 0.012, 5, 6, 5, 6),
	('Banyan', 'India,India_tropical,India_coastal,India_semi_arid', 10, 35.0, 0.96, 0.025, 4, 6, 5, 7),
	('Eucalyptus', 'India,India_tropical,India_arid,India_semi_arid,India_coastal', 5, 28.0, 0.92, 0.009, 8, 4, 4, 5),
	('Acacia', 'India,India_tropical,India_arid,India_semi_arid,India_himalayan', 4, 15.0, 0.91, 0.008, 8, 9, 6, 7),
	('Jamun', 'India,India_tropical,India_subtropical,India_semi_arid,India_coastal', 8, 22.0, 0.94, 0.012, 5, 6, 5, 6),
	('Pongamia', 'India,India_tropical,India_coastal,India_semi_arid', 6, 18.0, 0.92, 0.01, 6, 7, 5, 7),
	('Tamarind', 'India_tropical,India_arid,India_semi_arid', 10, 20.0, 0.93, 0.015, 4, 9, 6, 8),
	('Arjuna', 'India_tropical,India_subtropical,India_semi_arid', 8, 24.0, 0.94, 0.012, 5, 5, 5, 6),
	('Moringa', 'India,India_tropical,India_arid,India_semi_arid', 3, 12.0, 0.88, 0.006, 9, 9, 5, 6),
	('Casuarina', 'India_coastal,India_tropical', 4, 30.0, 0.88, 0.008, 9, 4, 3, 5),
	('Sheesham', 'India_subtropical,India_semi_arid,India_himalayan', 8, 22.0, 0.92, 0.01, 6, 6, 5, 5),
	('Khejri', 'India_arid', 12, 10.0, 0.93, 0.01, 3, 10, 7, 8),
	('Amla', 'India,India_tropical,India_subtropical,India_semi_arid', 7, 16.0, 0.93, 0.01, 5, 7, 5, 8),
	('Mahua', 'India_tropical,India_subtropical', 10, 20.0, 0.92, 0.015, 4, 6, 5, 6),
	('Sal', 'India_tropical,India_northeastern', 12, 26.0, 0.91, 0.015, 4, 5, 5, 6),
	('Chir Pine', 'India_himalayan', 15, 24.0, 0.90, 0.012, 3, 6, 3, 6)

on conflict (name) do update set
	region = excluded.region,
	maturity_years = excluded.maturity_years,
	peak_sequestration_kg = excluded.peak_sequestration_kg,
	annual_survival_rate = excluded.annual_survival_rate,
	land_per_tree_hectare = excluded.land_per_tree_hectare,
	growth_rate_class = excluded.growth_rate_class,
	drought_score = excluded.drought_score,
	fire_score = excluded.fire_score,
	disease_score = excluded.disease_score;
