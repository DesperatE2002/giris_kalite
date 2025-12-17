-- Mevcut BOM verilerini kontrol et
SELECT 
    o.otpa_number,
    o.battery_pack_count,
    COUNT(b.id) as malzeme_sayisi,
    GROUP_CONCAT(b.material_code || ': ' || b.required_quantity) as malzemeler
FROM otpa o
LEFT JOIN bom_items b ON o.id = b.otpa_id
GROUP BY o.id;
