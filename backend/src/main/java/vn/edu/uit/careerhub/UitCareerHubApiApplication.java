package vn.edu.uit.careerhub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.WebApplicationType;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.scheduling.annotation.EnableScheduling;

import vn.edu.uit.careerhub.config.DotenvBootstrap;
import vn.edu.uit.careerhub.database.DatabaseTasks;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class UitCareerHubApiApplication {

	public static void main(String[] args) {
		DotenvBootstrap.load();
		String databaseCommand = args.length == 1 && args[0].startsWith("db:") ? args[0] : null;
		if ("db:e2e:reset".equals(databaseCommand)) {
			String target = setting("DATABASE_URL_E2E");
			String allowed = setting("ALLOW_E2E_RESET");
			String runtime = setting("DATABASE_URL");
			if (!"true".equalsIgnoreCase(allowed)) throw new IllegalStateException("E2E reset đang bị khóa; cần ALLOW_E2E_RESET=true.");
			if (target == null || !target.matches("(?i).*/[^/?]*e2e[^/?]*(?:\\?.*)?$")) throw new IllegalStateException("DATABASE_URL_E2E bắt buộc và tên database phải chứa 'e2e'.");
			if (target.equals(runtime)) throw new IllegalStateException("DATABASE_URL_E2E phải tách khỏi database runtime.");
			System.setProperty("DATABASE_URL", target);
			System.setProperty("DATABASE_URL_DIRECT", target);
		}
		if (databaseCommand != null) {
			String directUrl = setting("DATABASE_URL_DIRECT");
			if (directUrl != null && !directUrl.isBlank()) System.setProperty("DATABASE_URL", directUrl);
		}
		SpringApplication application = new SpringApplication(UitCareerHubApiApplication.class);
		if (databaseCommand != null) application.setWebApplicationType(WebApplicationType.NONE);
		if (databaseCommand == null) {
			application.run(args);
			return;
		}
		try (ConfigurableApplicationContext context = application.run(args)) {
			DatabaseTasks tasks = context.getBean(DatabaseTasks.class);
			switch (databaseCommand) {
				case "db:migrate" -> tasks.migrate();
			case "db:seed" -> tasks.seed();
				case "db:setup" -> { tasks.migrate(); tasks.seed(); }
				case "db:demo:reset" -> {
					if (!"true".equalsIgnoreCase(setting("ALLOW_DEMO_RESET"))) throw new IllegalStateException("Demo reset đang bị khóa; cần ALLOW_DEMO_RESET=true.");
					tasks.resetDemo();
				}
				case "db:e2e:reset" -> { tasks.migrate(); tasks.resetDemo(); }
				case "db:ml:export" -> exportTrainingData(context);
				default -> throw new IllegalArgumentException("Lệnh database không được hỗ trợ: " + databaseCommand);
			}
		}
	}

	/** Writes ranker.csv and risk.csv for ml/train_*.py --data into ML_EXPORT_DIR (default ../ml/data). */
	private static void exportTrainingData(ConfigurableApplicationContext context) {
		vn.edu.uit.careerhub.service.MlTrainingDataService data = context.getBean(vn.edu.uit.careerhub.service.MlTrainingDataService.class);
		String directory = setting("ML_EXPORT_DIR");
		java.nio.file.Path target = java.nio.file.Path.of(directory == null || directory.isBlank() ? "../ml/data" : directory);
		java.util.List<double[]> ranker = data.rankerRows();
		java.util.List<double[]> risk = data.riskRows();
		java.util.List<String> rankerHeader = new java.util.ArrayList<>(vn.edu.uit.careerhub.ml.JobRankingFeatures.NAMES);
		rankerHeader.addAll(java.util.List.of("label", "group"));
		java.util.List<String> riskHeader = new java.util.ArrayList<>(vn.edu.uit.careerhub.ml.InternshipRiskFeatures.NAMES);
		riskHeader.add("label");
		vn.edu.uit.careerhub.ml.CsvExport.write(target.resolve("ranker.csv"), rankerHeader, ranker);
		vn.edu.uit.careerhub.ml.CsvExport.write(target.resolve("risk.csv"), riskHeader, risk);
		System.out.println("Đã xuất " + ranker.size() + " dòng xếp hạng và " + risk.size() + " dòng cảnh báo sớm vào " + target.toAbsolutePath());
	}

	private static String setting(String name) {
		String value = System.getProperty(name);
		return value == null ? System.getenv(name) : value;
	}

}
