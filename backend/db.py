"""Fachada de banco de dados para retrocompatibilidade total.

Re-exporta funções dos submódulos especializados de backend.core, backend.domain e backend.services.
"""

from backend.core.config import (
    get_app_config_path,
    get_default_db_path,
    get_last_db_path,
    set_last_db_path,
    get_db_path,
)

DB_PATH = get_db_path()

from backend.core.database import (
    get_connection,
)

from backend.core.schema import (
    create_schema,
    check_db_status_db,
    initialize_empty_db_db,
    format_database_db,
    reset_db,
    init_db,
)

from backend.domain.configuracoes import (
    seed_settings,
    get_db_settings,
    save_db_setting,
    save_all_db_settings,
)

from backend.domain.produtos import (
    get_product_statistics_db,
    update_product_db,
    verificar_historico_produto_db,
    alternar_status_produto_db,
    list_products_db,
    create_product_db,
    remove_product_db,
)

from backend.domain.fornecedores import (
    get_supplier_statistics_db,
    update_supplier_db,
    verificar_historico_fornecedor_db,
    alternar_status_fornecedor_db,
    list_suppliers_db,
    create_supplier_db,
    remove_supplier_db,
)

from backend.domain.rodadas import (
    list_rounds_with_metrics_db,
    update_round_db,
    verificar_historico_rodada_db,
    remove_round_db,
    duplicate_round_needs_db,
    list_rounds_db,
    create_round_db,
    check_round_dependencies_db,
    verificar_rodada_aberta,
)

from backend.domain.necessidades import (
    list_needs_db,
    create_need_db,
    remove_need_db,
)

from backend.domain.cotacoes import (
    get_global_quotes_history_db,
    list_quotes_db,
    save_quote_db,
    update_quote_db,
    remove_quote_db,
    get_quote_matrix_db,
    get_global_quote_history_db,
)

from backend.domain.alocacoes import (
    list_allocations_db,
    save_allocations_db,
    remove_allocation_db,
)

from backend.services.demo_service import (
    populate_demo_db_db,
    seed_data,
)
