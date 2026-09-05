"""Fachada de banco de dados para retrocompatibilidade total.

Re-exporta funções dos submódulos especializados de backend.core, backend.domain e backend.services.
"""

from backend.core.config import (
    get_app_config_path,
    get_db_path,
    get_default_db_path,
    get_last_db_path,
    set_last_db_path,
)

DB_PATH = get_db_path()

from backend.core.database import (
    get_connection,
)
from backend.core.schema import (
    check_db_status_db,
    create_schema,
    format_database_db,
    init_db,
    initialize_empty_db_db,
    reset_db,
)
from backend.domain.alocacoes import (
    list_allocations_db,
    remove_allocation_db,
    save_allocations_db,
)
from backend.domain.configuracoes import (
    get_db_settings,
    save_all_db_settings,
    save_db_setting,
    seed_settings,
)
from backend.domain.cotacoes import (
    get_global_quote_history_db,
    get_global_quotes_history_db,
    get_quote_matrix_db,
    list_quotes_db,
    remove_quote_db,
    save_quote_db,
    update_quote_db,
)
from backend.domain.fornecedores import (
    alternar_status_fornecedor_db,
    check_supplier_history_db,
    create_supplier_db,
    get_supplier_statistics_db,
    list_suppliers_db,
    remove_supplier_db,
    toggle_supplier_status_db,
    update_supplier_db,
    verificar_historico_fornecedor_db,
)
from backend.domain.necessidades import (
    create_need_db,
    list_needs_db,
    remove_need_db,
    reset_selected_suppliers_db,
    set_selected_supplier_db,
)
from backend.domain.produtos import (
    alternar_status_produto_db,
    check_product_history_db,
    create_product_db,
    get_product_statistics_db,
    list_products_db,
    remove_product_db,
    toggle_product_status_db,
    update_product_db,
    verificar_historico_produto_db,
)
from backend.domain.rodadas import (
    check_round_dependencies_db,
    check_round_history_db,
    create_round_db,
    duplicate_round_needs_db,
    list_rounds_db,
    list_rounds_with_metrics_db,
    remove_round_db,
    update_round_db,
    verificar_historico_rodada_db,
    verificar_rodada_aberta,
)
from backend.services.demo_service import (
    populate_demo_db_db,
    seed_data,
)
