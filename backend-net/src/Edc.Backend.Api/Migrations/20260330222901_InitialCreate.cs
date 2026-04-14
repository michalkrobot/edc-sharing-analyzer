using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Edc.Backend.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "edc_link_readings",
                columns: table => new
                {
                    time_from = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<int>(type: "integer", nullable: false),
                    producer_ean = table.Column<string>(type: "text", nullable: false),
                    consumer_ean = table.Column<string>(type: "text", nullable: false),
                    time_to = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    kwh_shared = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_edc_link_readings", x => new { x.tenant_id, x.producer_ean, x.consumer_ean, x.time_from });
                });

            migrationBuilder.CreateTable(
                name: "edc_readings",
                columns: table => new
                {
                    time_from = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<int>(type: "integer", nullable: false),
                    ean = table.Column<string>(type: "text", nullable: false),
                    time_to = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    is_producer = table.Column<bool>(type: "boolean", nullable: false),
                    kwh_total = table.Column<double>(type: "double precision", nullable: false),
                    kwh_remainder = table.Column<double>(type: "double precision", nullable: false),
                    kwh_missed = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_edc_readings", x => new { x.tenant_id, x.ean, x.time_from });
                });

            migrationBuilder.CreateTable(
                name: "otp_codes",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    code_hash = table.Column<string>(type: "text", nullable: false),
                    expires_at = table.Column<long>(type: "bigint", nullable: false),
                    used_at = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_otp_codes", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sessions",
                columns: table => new
                {
                    token_hash = table.Column<string>(type: "text", nullable: false),
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<long>(type: "bigint", nullable: false),
                    last_seen_at = table.Column<long>(type: "bigint", nullable: false),
                    revoked_at = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sessions", x => x.token_hash);
                });

            migrationBuilder.CreateTable(
                name: "tenant_admins",
                columns: table => new
                {
                    tenant_id = table.Column<int>(type: "integer", nullable: false),
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_admins", x => new { x.tenant_id, x.user_id });
                });

            migrationBuilder.CreateTable(
                name: "tenant_eans",
                columns: table => new
                {
                    tenant_id = table.Column<int>(type: "integer", nullable: false),
                    ean = table.Column<string>(type: "text", nullable: false),
                    label = table.Column<string>(type: "text", nullable: false),
                    member_name = table.Column<string>(type: "text", nullable: false),
                    is_public = table.Column<int>(type: "integer", nullable: false),
                    imported_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_eans", x => new { x.tenant_id, x.ean });
                });

            migrationBuilder.CreateTable(
                name: "tenant_edc_imports",
                columns: table => new
                {
                    tenant_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    filename = table.Column<string>(type: "text", nullable: false),
                    source_hash = table.Column<string>(type: "text", nullable: false),
                    csv_text = table.Column<string>(type: "text", nullable: false),
                    payload_json = table.Column<string>(type: "text", nullable: false),
                    producer_count = table.Column<int>(type: "integer", nullable: false),
                    consumer_count = table.Column<int>(type: "integer", nullable: false),
                    interval_count = table.Column<int>(type: "integer", nullable: false),
                    date_from = table.Column<long>(type: "bigint", nullable: false),
                    date_to = table.Column<long>(type: "bigint", nullable: false),
                    imported_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_edc_imports", x => x.tenant_id);
                });

            migrationBuilder.CreateTable(
                name: "tenant_edc_link_imports",
                columns: table => new
                {
                    tenant_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    filename = table.Column<string>(type: "text", nullable: false),
                    source_hash = table.Column<string>(type: "text", nullable: false),
                    csv_text = table.Column<string>(type: "text", nullable: false),
                    payload_json = table.Column<string>(type: "text", nullable: false),
                    link_count = table.Column<int>(type: "integer", nullable: false),
                    interval_count = table.Column<int>(type: "integer", nullable: false),
                    date_from = table.Column<long>(type: "bigint", nullable: false),
                    date_to = table.Column<long>(type: "bigint", nullable: false),
                    imported_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_edc_link_imports", x => x.tenant_id);
                });

            migrationBuilder.CreateTable(
                name: "tenants",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenants", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "user_eans",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    ean = table.Column<string>(type: "text", nullable: false),
                    label = table.Column<string>(type: "text", nullable: false),
                    member_name = table.Column<string>(type: "text", nullable: false),
                    imported_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_eans", x => new { x.user_id, x.ean });
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    email = table.Column<string>(type: "text", nullable: false),
                    full_name = table.Column<string>(type: "text", nullable: true),
                    role = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<int>(type: "integer", nullable: true),
                    typ = table.Column<string>(type: "text", nullable: true),
                    mesto = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<int>(type: "integer", nullable: false),
                    imported_at = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;");

            migrationBuilder.Sql("SELECT create_hypertable('edc_readings', by_range('time_from', INTERVAL '1 month'));");
            migrationBuilder.Sql("CREATE INDEX idx_er_tenant_ean_time ON edc_readings (tenant_id, ean, time_from DESC);");

            migrationBuilder.Sql("SELECT create_hypertable('edc_link_readings', by_range('time_from', INTERVAL '1 month'));");
            migrationBuilder.Sql("CREATE INDEX idx_elr_tenant_time ON edc_link_readings (tenant_id, time_from DESC);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "edc_link_readings");

            migrationBuilder.DropTable(
                name: "edc_readings");

            migrationBuilder.DropTable(
                name: "otp_codes");

            migrationBuilder.DropTable(
                name: "sessions");

            migrationBuilder.DropTable(
                name: "tenant_admins");

            migrationBuilder.DropTable(
                name: "tenant_eans");

            migrationBuilder.DropTable(
                name: "tenant_edc_imports");

            migrationBuilder.DropTable(
                name: "tenant_edc_link_imports");

            migrationBuilder.DropTable(
                name: "tenants");

            migrationBuilder.DropTable(
                name: "user_eans");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
